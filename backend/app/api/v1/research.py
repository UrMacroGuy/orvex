from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query, status
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUserDep, QueryServiceDep
from app.schemas.common import CursorPage, Envelope, Meta
from app.schemas.finance import ResearchType, TimeHorizon
from app.schemas.query import ModelSelection, QueryCreate, QueryOptions, QueryOut
from app.schemas.synthesis import FullQueryResult

router = APIRouter(prefix="/research", tags=["research"])

_RESEARCH_DEFAULTS: dict[ResearchType, dict] = {
    ResearchType.STOCK: {"temperature": 0.5, "max_tokens": 4096},
    ResearchType.EARNINGS: {"temperature": 0.3, "max_tokens": 3000},
    ResearchType.MACRO: {"temperature": 0.6, "max_tokens": 4096},
    ResearchType.SECTOR: {"temperature": 0.5, "max_tokens": 3500},
    ResearchType.COMPANY: {"temperature": 0.5, "max_tokens": 4096},
    ResearchType.CRYPTO: {"temperature": 0.6, "max_tokens": 3500},
}


def _build_finance_prompt(
    query: str,
    *,
    ticker: str | None,
    research_type: ResearchType,
    time_horizon: TimeHorizon | None,
) -> str:
    parts: list[str] = []
    if ticker:
        parts.append(f"Ticker: {ticker.upper()}")
    if time_horizon:
        horizon_labels = {
            TimeHorizon.INTRADAY: "intraday",
            TimeHorizon.SHORT_TERM: "short-term (days to weeks)",
            TimeHorizon.MEDIUM_TERM: "medium-term (weeks to months)",
            TimeHorizon.LONG_TERM: "long-term (months to years)",
        }
        parts.append(f"Time horizon: {horizon_labels[time_horizon]}")
    parts.append(f"Research focus: {research_type.value.replace('_', ' ').title()}")
    parts.append("")
    parts.append(query)
    return "\n".join(parts)


class FinancialResearchCreate:
    """Request body for financial research — validated via dependency."""


from pydantic import BaseModel, Field


class FinancialResearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=20_000)
    selected_models: list[ModelSelection] = Field(min_length=1, max_length=8)
    research_type: ResearchType = ResearchType.STOCK
    ticker: str | None = Field(default=None, max_length=10)
    company_name: str | None = Field(default=None, max_length=128)
    time_horizon: TimeHorizon | None = None
    web_research: bool = False


@router.post(
    "",
    response_model=Envelope[QueryOut],
    status_code=status.HTTP_201_CREATED,
)
async def create_research(
    payload: FinancialResearchRequest,
    user: CurrentUserDep,
    service: QueryServiceDep,
) -> Envelope[QueryOut]:
    defaults = _RESEARCH_DEFAULTS.get(payload.research_type, {})
    prompt = _build_finance_prompt(
        payload.query,
        ticker=payload.ticker,
        research_type=payload.research_type,
        time_horizon=payload.time_horizon,
    )
    query_create = QueryCreate(
        prompt=prompt,
        selected_models=payload.selected_models,
        options=QueryOptions(
            web_research=payload.web_research,
            temperature=defaults.get("temperature", 0.5),
            max_tokens=defaults.get("max_tokens", 4096),
            research_type=payload.research_type,
            ticker=payload.ticker,
            company_name=payload.company_name,
            time_horizon=payload.time_horizon,
        ),
    )
    created = await service.create(user_id=user.id, payload=query_create)
    return Envelope(data=created)


@router.get("", response_model=Envelope[CursorPage[QueryOut]])
async def list_research(
    user: CurrentUserDep,
    service: QueryServiceDep,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> Envelope[CursorPage[QueryOut]]:
    items, next_cursor = await service.list(
        user_id=user.id, cursor=cursor, limit=limit
    )
    return Envelope(
        data=CursorPage(items=items, next_cursor=next_cursor),
        meta=Meta(next_cursor=next_cursor),
    )


@router.get("/{query_id}", response_model=Envelope[FullQueryResult])
async def get_research(
    query_id: UUID,
    user: CurrentUserDep,
    service: QueryServiceDep,
) -> Envelope[FullQueryResult]:
    result = await service.get(user_id=user.id, query_id=query_id)
    return Envelope(data=result)


@router.get("/{query_id}/stream")
async def stream_research(
    query_id: UUID,
    user: CurrentUserDep,
    service: QueryServiceDep,
) -> StreamingResponse:
    async def _gen():
        async for event in service.stream(user_id=user.id, query_id=query_id):
            yield f"event: {event.type.value}\ndata: {event.model_dump_json()}\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
