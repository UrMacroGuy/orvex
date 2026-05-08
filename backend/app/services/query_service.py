from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncIterator, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.query import Query as QueryModel
from app.models.response import ModelResponse as ResponseModel
from app.models.synthesis import Synthesis as SynthesisModel
from app.orchestration.normalizer import NormalizedResponse
from app.orchestration.pipeline import OrchestrationPipeline
from app.orchestration.synthesis import FinancialSynthesisEngine, SynthesisEngine
from app.providers.errors import ProviderError
from app.schemas.errors import ErrorBody, ErrorCode
from app.schemas.events import (
    DoneEvent,
    ErrorEvent,
    ModelCompletedEvent,
    ModelFailedEvent,
    ModelStartedEvent,
    QueryStartedEvent,
    StreamEvent,
    SynthesisReadyEvent,
    SynthesisStartedEvent,
)
from app.schemas.provider import ProviderId
from app.schemas.query import (
    ModelResponseOut,
    ModelResponseStatus,
    ModelSelection,
    QueryCreate,
    QueryOptions,
    QueryOut,
    QueryStatus,
    TokenUsage,
)
from app.schemas.synthesis import FullQueryResult, SynthesisOut

from .event_bus import EventBus, event_bus
from .key_service import KeyService

log = logging.getLogger(__name__)

_BG_TASKS: set[asyncio.Task] = set()

_ERR_CODE_MAP: dict[str, ErrorCode] = {
    "PROVIDER_TIMEOUT": ErrorCode.PROVIDER_TIMEOUT,
    "PROVIDER_AUTH": ErrorCode.PROVIDER_AUTH,
    "RATE_LIMITED": ErrorCode.RATE_LIMITED,
    "PROVIDER_UNAVAILABLE": ErrorCode.PROVIDER_UNAVAILABLE,
}


def _map_error_code(code: Optional[str]) -> ErrorCode:
    if not code:
        return ErrorCode.PROVIDER_ERROR
    return _ERR_CODE_MAP.get(code, ErrorCode.PROVIDER_ERROR)


def _fire_and_forget(coro) -> None:
    task = asyncio.create_task(coro)
    _BG_TASKS.add(task)
    task.add_done_callback(_BG_TASKS.discard)


def _select_synthesizer(options: QueryOptions) -> SynthesisEngine:
    """Use FinancialSynthesisEngine when a research_type is specified."""
    if options.research_type is not None:
        return FinancialSynthesisEngine()
    return SynthesisEngine()


class _BoundKeyResolver:
    def __init__(self, session: AsyncSession, user_id: UUID) -> None:
        self._svc = KeyService(session)
        self._user_id = user_id

    async def resolve(self, user_id: UUID, provider_id: str) -> str:
        return await self._svc.resolve_active_key(
            user_id=self._user_id, provider_id=provider_id
        )


class QueryService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        bus: EventBus = event_bus,
        synthesizer: Optional[SynthesisEngine] = None,
    ) -> None:
        self._db = session
        self._bus = bus
        self._synth = synthesizer  # None means auto-select per query

    async def create(self, *, user_id: UUID, payload: QueryCreate) -> QueryOut:
        row = QueryModel(
            id=uuid4(),
            user_id=user_id,
            prompt=payload.prompt,
            selected_models=[m.model_dump(mode="json") for m in payload.selected_models],
            options=payload.options.model_dump(mode="json"),
            status=QueryStatus.PENDING.value,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        _fire_and_forget(
            self._execute(query_id=row.id, user_id=user_id, payload=payload)
        )
        return self._to_out(row)

    async def get(self, *, user_id: UUID, query_id: UUID) -> FullQueryResult:
        stmt = (
            select(QueryModel)
            .options(
                selectinload(QueryModel.responses),
                selectinload(QueryModel.synthesis),
            )
            .where(QueryModel.id == query_id, QueryModel.user_id == user_id)
        )
        row = (await self._db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="query not found")
        synth_out = self._synth_to_out(row.synthesis) if row.synthesis else None
        return FullQueryResult(
            query=self._to_out(row),
            responses=[self._response_to_out(r) for r in row.responses],
            synthesis=synth_out,
        )

    async def list(
        self,
        *,
        user_id: UUID,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> tuple[list[QueryOut], Optional[str]]:
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
        stmt = select(QueryModel.id).where(
            QueryModel.id == query_id, QueryModel.user_id == user_id
        )
        if (await self._db.execute(stmt)).scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="query not found")
        async for ev in self._bus.subscribe(query_id):
            yield ev

    async def _execute(
        self, *, query_id: UUID, user_id: UUID, payload: QueryCreate
    ) -> None:
        settings = get_settings()
        synthesizer = self._synth or _select_synthesizer(payload.options)
        try:
            async with SessionLocal() as session:
                await self._set_status(session, query_id, QueryStatus.RUNNING)
                await self._bus.publish(query_id, QueryStartedEvent(query_id=query_id))
                for sel in payload.selected_models:
                    await self._bus.publish(
                        query_id,
                        ModelStartedEvent(
                            query_id=query_id,
                            provider_id=sel.provider_id,
                            model_id=sel.model_id,
                        ),
                    )
                resolver = _BoundKeyResolver(session, user_id)
                pipeline = OrchestrationPipeline(
                    key_resolver=resolver,
                    attempts=settings.pipeline_attempts,
                    timeout_s=settings.pipeline_timeout_s,
                )
                pipe_result = await pipeline.run(
                    user_id=user_id,
                    prompt=payload.prompt,
                    selected_models=payload.selected_models,
                    options=payload.options,
                )

                response_rows = await self._persist_responses(
                    session, query_id, pipe_result.responses
                )
                for normalized, db_row in zip(pipe_result.responses, response_rows):
                    if normalized.status == ModelResponseStatus.OK:
                        await self._bus.publish(
                            query_id,
                            ModelCompletedEvent(
                                query_id=query_id,
                                response=self._response_to_out(db_row),
                            ),
                        )
                    else:
                        await self._bus.publish(
                            query_id,
                            ModelFailedEvent(
                                query_id=query_id,
                                provider_id=ProviderId(normalized.provider_id),
                                model_id=normalized.model_id,
                                error=ErrorBody(
                                    code=_map_error_code(normalized.error_code),
                                    message=normalized.error or "model failed",
                                ),
                            ),
                        )

                await self._bus.publish(
                    query_id, SynthesisStartedEvent(query_id=query_id)
                )
                synth_data = synthesizer.run(responses=pipe_result.responses)
                synth_row = await self._persist_synthesis(session, query_id, synth_data)
                await self._bus.publish(
                    query_id,
                    SynthesisReadyEvent(
                        query_id=query_id,
                        synthesis=self._synth_to_out(synth_row),
                    ),
                )

                await self._mark_complete(session, query_id)
                await self._bus.publish(query_id, DoneEvent(query_id=query_id))
        except ProviderError as e:
            log.warning(
                "pipeline_provider_error",
                extra={"qid": str(query_id), "code": e.code, "msg": e.message},
            )
            await self._fail_and_emit(
                query_id, message=e.message, code=ErrorCode.PROVIDER_ERROR
            )
        except Exception as e:  # noqa: BLE001
            log.exception("pipeline_failed", extra={"qid": str(query_id)})
            await self._fail_and_emit(
                query_id, message=str(e) or "pipeline failed", code=ErrorCode.INTERNAL
            )
        finally:
            await self._bus.close(query_id)

    async def _fail_and_emit(
        self, query_id: UUID, *, message: str, code: ErrorCode
    ) -> None:
        try:
            async with SessionLocal() as session:
                await self._fail(session, query_id, message)
        except Exception:
            log.exception("failed_to_record_failure", extra={"qid": str(query_id)})
        await self._bus.publish(
            query_id,
            ErrorEvent(
                query_id=query_id,
                error=ErrorBody(code=code, message=message),
            ),
        )

    async def _set_status(
        self, session: AsyncSession, query_id: UUID, status: QueryStatus
    ) -> None:
        row = await session.get(QueryModel, query_id)
        if row is None:
            return
        row.status = status.value
        await session.commit()

    async def _mark_complete(self, session: AsyncSession, query_id: UUID) -> None:
        row = await session.get(QueryModel, query_id)
        if row is None:
            return
        row.status = QueryStatus.COMPLETE.value
        row.completed_at = datetime.now(timezone.utc)
        await session.commit()

    async def _fail(
        self, session: AsyncSession, query_id: UUID, message: str
    ) -> None:
        row = await session.get(QueryModel, query_id)
        if row is None:
            return
        row.status = QueryStatus.FAILED.value
        row.error = message[:1000]
        row.completed_at = datetime.now(timezone.utc)
        await session.commit()

    async def _persist_responses(
        self,
        session: AsyncSession,
        query_id: UUID,
        responses: list[NormalizedResponse],
    ) -> list[ResponseModel]:
        rows: list[ResponseModel] = []
        for r in responses:
            row = ResponseModel(
                id=uuid4(),
                query_id=query_id,
                provider_id=r.provider_id,
                model_id=r.model_id,
                status=r.status.value,
                text=r.text,
                latency_ms=r.latency_ms,
                input_tokens=r.usage.input_tokens if r.usage else 0,
                output_tokens=r.usage.output_tokens if r.usage else 0,
                error=r.error,
                error_code=r.error_code,
            )
            session.add(row)
            rows.append(row)
        await session.commit()
        for row in rows:
            await session.refresh(row)
        return rows

    async def _persist_synthesis(
        self, session: AsyncSession, query_id: UUID, data
    ) -> SynthesisModel:
        row = SynthesisModel(
            id=uuid4(),
            query_id=query_id,
            summary=data.summary,
            consensus=[c.model_dump(mode="json") for c in data.consensus],
            disagreements=[d.model_dump(mode="json") for d in data.disagreements],
            unique_insights=[u.model_dump(mode="json") for u in data.unique_insights],
            citations=[c.model_dump(mode="json") for c in data.citations],
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row

    @staticmethod
    def _to_out(row: QueryModel) -> QueryOut:
        return QueryOut(
            id=row.id,
            user_id=row.user_id,
            prompt=row.prompt,
            selected_models=[ModelSelection(**m) for m in (row.selected_models or [])],
            options=QueryOptions(**(row.options or {})),
            status=QueryStatus(row.status),
            error=row.error,
            completed_at=row.completed_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _response_to_out(row: ResponseModel) -> ModelResponseOut:
        return ModelResponseOut(
            id=row.id,
            query_id=row.query_id,
            provider_id=ProviderId(row.provider_id),
            model_id=row.model_id,
            status=ModelResponseStatus(row.status),
            text=row.text,
            latency_ms=row.latency_ms,
            usage=TokenUsage(
                input_tokens=row.input_tokens,
                output_tokens=row.output_tokens,
            ),
            error=row.error,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _synth_to_out(row: SynthesisModel) -> SynthesisOut:
        return SynthesisOut(
            id=row.id,
            query_id=row.query_id,
            summary=row.summary,
            consensus=row.consensus or [],
            disagreements=row.disagreements or [],
            unique_insights=row.unique_insights or [],
            citations=row.citations or [],
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
