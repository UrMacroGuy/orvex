from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from .common import IdentifiedModel
from .finance import CatalystItem, MarketSentiment, PriceTarget, RiskFactor
from .provider import ProviderId
from .query import ModelResponseOut, QueryOut


class ConsensusClaim(BaseModel):
    id: str
    claim: str
    supporting_models: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


class DisagreementPosition(BaseModel):
    provider_id: ProviderId
    model_id: str
    position: str


class Disagreement(BaseModel):
    id: str
    topic: str
    positions: list[DisagreementPosition] = Field(default_factory=list)


class UniqueInsight(BaseModel):
    id: str
    insight: str
    provider_id: ProviderId
    model_id: str


class WebSource(BaseModel):
    url: str
    title: str
    snippet: Optional[str] = None


class Citation(BaseModel):
    id: str
    url: str
    title: str
    snippet: Optional[str] = None
    claim_ids: list[str] = Field(default_factory=list)


# Finance-specific synthesis types

class SentimentPosition(BaseModel):
    model_id: str
    provider_id: str
    sentiment: MarketSentiment
    signal: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


class BullishBearishAnalysis(BaseModel):
    overall_sentiment: MarketSentiment = MarketSentiment.NEUTRAL
    bullish_signals: list[SentimentPosition] = Field(default_factory=list)
    bearish_signals: list[SentimentPosition] = Field(default_factory=list)
    neutral_signals: list[SentimentPosition] = Field(default_factory=list)
    bull_count: int = 0
    bear_count: int = 0


class SynthesisData(BaseModel):
    summary: str = ""
    consensus: list[ConsensusClaim] = Field(default_factory=list)
    disagreements: list[Disagreement] = Field(default_factory=list)
    unique_insights: list[UniqueInsight] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    # Finance extensions (populated for financial queries)
    sentiment: Optional[BullishBearishAnalysis] = None
    price_targets: list[PriceTarget] = Field(default_factory=list)
    risk_factors: list[RiskFactor] = Field(default_factory=list)
    catalysts: list[CatalystItem] = Field(default_factory=list)


class SynthesisOut(IdentifiedModel, SynthesisData):
    query_id: UUID


class FullQueryResult(BaseModel):
    query: QueryOut
    responses: list[ModelResponseOut] = Field(default_factory=list)
    synthesis: Optional[SynthesisOut] = None
