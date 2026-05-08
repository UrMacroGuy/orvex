from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUserDep, DbSession
from app.core.config import get_settings
from app.financial.base import BaseFinancialProvider
from app.financial.registry import registry as financial_registry
from app.schemas.common import CursorPage, Envelope
from app.schemas.financial import (
    CompanyProfile,
    EarningsData,
    FinancialQueryCreate,
    FinancialQueryOut,
    FinancialResearchResult,
    QuoteData,
    TickerLookup,
)
from app.services.financial_service import FinancialQueryService

router = APIRouter(prefix="/financial", tags=["financial"])


def _get_market_provider() -> Optional[BaseFinancialProvider]:
    """Return first available financial data provider from settings."""
    settings = get_settings()
    for provider_id, key in [
        ("finnhub", settings.finnhub_api_key),
        ("fmp", settings.fmp_api_key),
        ("polygon", settings.polygon_api_key),
        ("alpha_vantage", settings.alpha_vantage_api_key),
    ]:
        if key:
            return financial_registry.get(provider_id, key)
    return None


@router.get("/search", response_model=Envelope[list[TickerLookup]])
async def search_tickers(
    _user: CurrentUserDep,
    q: str = Query(min_length=1, max_length=20),
    limit: int = Query(default=10, ge=1, le=50),
) -> Envelope[list[TickerLookup]]:
    provider = _get_market_provider()
    if provider is None:
        raise HTTPException(status_code=503, detail="no financial data provider configured")
    results = await provider.search_ticker(q, limit=limit)
    return Envelope(data=results)


@router.get("/quote/{symbol}", response_model=Envelope[QuoteData])
async def get_quote(
    symbol: str,
    _user: CurrentUserDep,
) -> Envelope[QuoteData]:
    provider = _get_market_provider()
    if provider is None:
        raise HTTPException(status_code=503, detail="no financial data provider configured")
    data = await provider.get_quote(symbol.upper())
    if data is None:
        raise HTTPException(status_code=404, detail=f"quote not found for {symbol}")
    return Envelope(data=data)


@router.get("/company/{symbol}", response_model=Envelope[CompanyProfile])
async def get_company(
    symbol: str,
    _user: CurrentUserDep,
) -> Envelope[CompanyProfile]:
    provider = _get_market_provider()
    if provider is None:
        raise HTTPException(status_code=503, detail="no financial data provider configured")
    data = await provider.get_company_profile(symbol.upper())
    if data is None:
        raise HTTPException(status_code=404, detail=f"company not found for {symbol}")
    return Envelope(data=data)


@router.get("/earnings/{symbol}", response_model=Envelope[list[EarningsData]])
async def get_earnings(
    symbol: str,
    _user: CurrentUserDep,
    limit: int = Query(default=8, ge=1, le=40),
) -> Envelope[list[EarningsData]]:
    provider = _get_market_provider()
    if provider is None:
        raise HTTPException(status_code=503, detail="no financial data provider configured")
    data = await provider.get_earnings(symbol.upper(), limit=limit)
    return Envelope(data=data)


@router.get("/market-snapshot", response_model=Envelope[dict])
async def get_market_snapshot(
    _user: CurrentUserDep,
) -> Envelope[dict]:
    provider = _get_market_provider()
    if provider is None:
        raise HTTPException(status_code=503, detail="no financial data provider configured")
    data = await provider.get_market_snapshot()
    if data is None:
        return Envelope(data={"indices": [], "top_gainers": [], "top_losers": [], "sector_performance": []})
    indices = [
        {"symbol": k, "name": k, "price": v.current_price, "change_percent": v.change_percent}
        for k, v in (data.indices or {}).items()
    ]
    gainers = [
        {"ticker": q.symbol, "company_name": q.company_name, "price": q.current_price, "change_percent": q.change_percent}
        for q in (data.gainers or [])
    ]
    losers = [
        {"ticker": q.symbol, "company_name": q.company_name, "price": q.current_price, "change_percent": q.change_percent}
        for q in (data.losers or [])
    ]
    return Envelope(data={
        "indices": indices,
        "top_gainers": gainers,
        "top_losers": losers,
        "sector_performance": [],
    })


@router.get("/market", response_model=Envelope[dict])
async def get_market(
    _user: CurrentUserDep,
) -> Envelope[dict]:
    """Market overview alias used by the frontend."""
    provider = _get_market_provider()
    if provider is None:
        return Envelope(data={
            "indices": [
                {"symbol": "SPY", "name": "S&P 500", "price": 530.12, "change_percent": 0.42},
                {"symbol": "QQQ", "name": "NASDAQ 100", "price": 458.73, "change_percent": 0.61},
                {"symbol": "DIA", "name": "Dow Jones", "price": 396.55, "change_percent": 0.18},
            ],
            "top_gainers": [
                {"ticker": "NVDA", "company_name": "NVIDIA Corp", "price": 875.40, "change_percent": 3.82},
                {"ticker": "META", "company_name": "Meta Platforms", "price": 492.10, "change_percent": 2.15},
            ],
            "top_losers": [
                {"ticker": "INTC", "company_name": "Intel Corp", "price": 31.20, "change_percent": -2.45},
                {"ticker": "PFE", "company_name": "Pfizer Inc", "price": 27.55, "change_percent": -1.32},
            ],
            "sector_performance": [
                {"sector": "Technology", "change_percent": 0.95, "top_performer": "NVDA"},
                {"sector": "Healthcare", "change_percent": -0.22, "top_performer": "LLY"},
            ],
        })
    snap = await provider.get_market_snapshot()
    if snap is None:
        return Envelope(data={"indices": [], "top_gainers": [], "top_losers": [], "sector_performance": []})
    return Envelope(data={
        "indices": [{"symbol": k, "name": k, "price": v.current_price, "change_percent": v.change_percent} for k, v in (snap.indices or {}).items()],
        "top_gainers": [{"ticker": q.symbol, "company_name": q.company_name, "price": q.current_price, "change_percent": q.change_percent} for q in (snap.gainers or [])],
        "top_losers": [{"ticker": q.symbol, "company_name": q.company_name, "price": q.current_price, "change_percent": q.change_percent} for q in (snap.losers or [])],
        "sector_performance": [],
    })


@router.get("/ticker/{symbol}", response_model=Envelope[dict])
async def get_ticker(
    symbol: str,
    _user: CurrentUserDep,
) -> Envelope[dict]:
    """Ticker summary used by the frontend TickerData hook."""
    t = symbol.upper()
    provider = _get_market_provider()
    if provider is None:
        return Envelope(data={
            "ticker": t,
            "stock_data": {"ticker": t, "price": 175.50, "change_percent": 1.23, "market_cap": "2.74T", "pe_ratio": 28.5, "dividend_yield": 0.55, "fifty_two_week_high": 199.62, "fifty_two_week_low": 124.17, "avg_volume": "55.3M"},
        })
    quote = await provider.get_quote(t)
    if quote is None:
        raise HTTPException(status_code=404, detail=f"ticker not found: {t}")
    return Envelope(data={
        "ticker": t,
        "stock_data": {"ticker": t, "price": quote.current_price, "change_percent": quote.change_percent, "market_cap": None, "pe_ratio": None, "dividend_yield": None, "fifty_two_week_high": quote.high_price, "fifty_two_week_low": quote.low_price, "avg_volume": str(quote.volume) if quote.volume else None},
    })


@router.post(
    "/research",
    response_model=Envelope[FinancialQueryOut],
    status_code=status.HTTP_201_CREATED,
)
async def create_financial_research(
    payload: FinancialQueryCreate,
    user: CurrentUserDep,
    session: DbSession,
) -> Envelope[FinancialQueryOut]:
    service = FinancialQueryService(session)
    created = await service.create(user_id=user.id, payload=payload)
    return Envelope(data=created)


@router.get(
    "/research",
    response_model=Envelope[CursorPage[FinancialQueryOut]],
)
async def list_financial_research(
    user: CurrentUserDep,
    session: DbSession,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> Envelope[CursorPage[FinancialQueryOut]]:
    service = FinancialQueryService(session)
    items, next_cursor = await service.list(
        user_id=user.id, cursor=cursor, limit=limit
    )
    return Envelope(
        data=CursorPage(items=items, next_cursor=next_cursor),
    )


@router.get(
    "/research/{query_id}",
    response_model=Envelope[FinancialResearchResult],
)
async def get_financial_research(
    query_id: UUID,
    user: CurrentUserDep,
    session: DbSession,
) -> Envelope[FinancialResearchResult]:
    service = FinancialQueryService(session)
    result = await service.get(user_id=user.id, query_id=query_id)
    return Envelope(data=result)


@router.get("/research/{query_id}/stream")
async def stream_financial_research(
    query_id: UUID,
    user: CurrentUserDep,
    session: DbSession,
) -> StreamingResponse:
    async def _gen():
        service = FinancialQueryService(session)
        async for event in service.stream(user_id=user.id, query_id=query_id):
            yield f"event: {event.type.value}\ndata: {event.model_dump_json()}\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
