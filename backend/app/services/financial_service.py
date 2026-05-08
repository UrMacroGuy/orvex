from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncIterator, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.financial.pipeline import FinancialOrchestrationPipeline
from app.models.query import Query as QueryModel
from app.schemas.events import (
    DoneEvent,
    QueryStartedEvent,
    StreamEvent,
    SynthesisReadyEvent,
    SynthesisStartedEvent,
)
from app.schemas.financial import (
    FinancialQueryCreate,
    FinancialQueryOut,
    FinancialResearchResult,
)
from app.schemas.synthesis import SynthesisOut
from app.services.event_bus import EventBus, event_bus
from app.services.key_service import KeyService

log = logging.getLogger(__name__)

_BG_TASKS: set[asyncio.Task] = set()


def _fire_and_forget(coro) -> None:
    task = asyncio.create_task(coro)
    _BG_TASKS.add(task)
    task.add_done_callback(_BG_TASKS.discard)


class _BoundKeyResolver:
    def __init__(self, session: AsyncSession, user_id: UUID) -> None:
        self._svc = KeyService(session)
        self._user_id = user_id

    async def resolve(self, user_id: UUID, provider_id: str) -> str:
        return await self._svc.resolve_active_key(
            user_id=self._user_id, provider_id=provider_id
        )


class FinancialQueryService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        bus: EventBus = event_bus,
    ) -> None:
        self._db = session
        self._bus = bus

    async def create(
        self, *, user_id: UUID, payload: FinancialQueryCreate
    ) -> FinancialQueryOut:
        """Create and execute financial research query."""
        row = QueryModel(
            id=uuid4(),
            user_id=user_id,
            prompt=payload.query,
            selected_models=[
                {"provider_id": p, "model_id": m} for p, m in payload.selected_models
            ],
            options={
                "ticker": payload.ticker,
                "web_research": payload.include_web_research,
                "temperature": 0.5,
            },
            status="pending",
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)

        _fire_and_forget(
            self._execute_financial(
                query_id=row.id,
                user_id=user_id,
                payload=payload,
            )
        )
        return self._to_out(row)

    async def get(
        self, *, user_id: UUID, query_id: UUID
    ) -> FinancialResearchResult:
        """Retrieve financial research result."""
        stmt = select(QueryModel).where(
            QueryModel.id == query_id, QueryModel.user_id == user_id
        )
        row = (await self._db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="query not found")

        return FinancialResearchResult(
            query=self._to_out(row),
            synthesis=None,
            research_depth="standard",
            analysis_timestamp=datetime.now(timezone.utc).isoformat(),
        )

    async def list(
        self,
        *,
        user_id: UUID,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> tuple[list[FinancialQueryOut], Optional[str]]:
        """List financial queries for user."""
        stmt = (
            select(QueryModel)
            .where(QueryModel.user_id == user_id)
            .order_by(desc(QueryModel.created_at))
            .limit(limit + 1)
        )
        if cursor:
            try:
                ts = datetime.fromisoformat(cursor)
                stmt = stmt.where(QueryModel.created_at < ts)
            except ValueError:
                pass

        rows = list((await self._db.execute(stmt)).scalars().all())
        next_cursor: Optional[str] = None
        if len(rows) > limit:
            tail = rows[limit - 1]
            next_cursor = tail.created_at.isoformat()
            rows = rows[:limit]

        return [self._to_out(r) for r in rows], next_cursor

    async def stream(
        self, *, user_id: UUID, query_id: UUID
    ) -> AsyncIterator[StreamEvent]:
        """Stream financial research events."""
        stmt = select(QueryModel.id).where(
            QueryModel.id == query_id, QueryModel.user_id == user_id
        )
        if (await self._db.execute(stmt)).scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="query not found")

        async for ev in self._bus.subscribe(query_id):
            yield ev

    async def _execute_financial(
        self,
        *,
        query_id: UUID,
        user_id: UUID,
        payload: FinancialQueryCreate,
    ) -> None:
        """Execute financial research pipeline and publish events."""
        settings = get_settings()
        try:
            await self._bus.publish(query_id, QueryStartedEvent(query_id=query_id))

            async with SessionLocal() as session:
                await self._set_status(session, query_id, "running")

                resolver = _BoundKeyResolver(session, user_id)
                pipeline = FinancialOrchestrationPipeline(
                    key_resolver=resolver,
                    attempts=settings.pipeline_attempts,
                    timeout_s=settings.pipeline_timeout_s,
                )

                await self._bus.publish(query_id, SynthesisStartedEvent(query_id=query_id))
                result = await pipeline.run(user_id=user_id, payload=payload)

                synthesis_out = SynthesisOut(
                    id=uuid4(),
                    query_id=query_id,
                    summary=result.synthesis.summary or f"Financial analysis for {payload.ticker}",
                    created_at=datetime.now(timezone.utc),
                )
                await self._bus.publish(
                    query_id,
                    SynthesisReadyEvent(
                        query_id=query_id,
                        synthesis=synthesis_out,
                        financial_synthesis=result.synthesis.model_dump(),
                    ),
                )
                await self._bus.publish(query_id, DoneEvent(query_id=query_id))
                await self._bus.close(query_id)

                await self._mark_complete(session, query_id)
                log.info(
                    "financial_query_complete",
                    extra={
                        "ticker": payload.ticker,
                        "user_id": str(user_id),
                        "bullish": len(result.synthesis.bullish_theses),
                        "bearish": len(result.synthesis.bearish_theses),
                    },
                )
        except Exception as e:
            log.exception(
                "financial_query_failed",
                extra={"query_id": str(query_id), "error": str(e)},
            )
            await self._bus.close(query_id)

    async def _set_status(self, session: AsyncSession, query_id: UUID, status: str) -> None:
        row = await session.get(QueryModel, query_id)
        if row is None:
            return
        row.status = status
        await session.commit()

    async def _mark_complete(self, session: AsyncSession, query_id: UUID) -> None:
        row = await session.get(QueryModel, query_id)
        if row is None:
            return
        row.status = "complete"
        row.completed_at = datetime.now(timezone.utc)
        await session.commit()

    @staticmethod
    def _to_out(row: QueryModel) -> FinancialQueryOut:
        opts = row.options or {}
        ticker = opts.get("ticker") or (row.prompt[:10] if row.prompt else "UNKNOWN")
        return FinancialQueryOut(
            id=row.id,
            user_id=row.user_id,
            ticker=ticker,
            query=row.prompt,
            selected_models=[tuple(m.values()) for m in (row.selected_models or [])],
            status=row.status,
            error=row.error,
            completed_at=row.completed_at.isoformat() if row.completed_at else None,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


FinancialService = FinancialQueryService
