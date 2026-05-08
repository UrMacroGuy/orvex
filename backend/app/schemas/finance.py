from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ResearchType(str, Enum):
    STOCK = "stock"
    EARNINGS = "earnings"
    MACRO = "macro"
    SECTOR = "sector"
    COMPANY = "company"
    CRYPTO = "crypto"


class TimeHorizon(str, Enum):
    INTRADAY = "intraday"
    SHORT_TERM = "short_term"
    MEDIUM_TERM = "medium_term"
    LONG_TERM = "long_term"


class MarketSentiment(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class TickerInfo(BaseModel):
    symbol: str = Field(min_length=1, max_length=10)
    exchange: Optional[str] = None
    company_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None


class EarningsMetrics(BaseModel):
    quarter: Optional[str] = None
    eps_estimate: Optional[float] = None
    eps_actual: Optional[float] = None
    revenue_estimate: Optional[float] = None
    revenue_actual: Optional[float] = None
    guidance: Optional[str] = None


class MacroIndicator(BaseModel):
    name: str
    value: Optional[str] = None
    trend: Optional[str] = None
    impact: Optional[str] = None


class RiskFactor(BaseModel):
    id: str
    factor: str
    severity: MarketSentiment = MarketSentiment.NEUTRAL
    model_id: Optional[str] = None


class PriceTarget(BaseModel):
    model_id: str
    provider_id: str
    target: Optional[str] = None
    timeframe: Optional[str] = None
    rationale: Optional[str] = None


class CatalystItem(BaseModel):
    id: str
    catalyst: str
    direction: MarketSentiment
    model_id: str
