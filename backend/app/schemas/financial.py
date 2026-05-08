from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from .common import IdentifiedModel
from .provider import ProviderId
from .synthesis import Citation, ConsensusClaim, Disagreement, UniqueInsight


class AnalysisType(str, Enum):
    BULLISH_CASE = "bullish_case"
    BEARISH_CASE = "bearish_case"
    EARNINGS = "earnings"
    MACRO = "macro"
    SECTOR = "sector"


class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


# Provider data schemas (for financial data providers)
class TickerLookup(BaseModel):
    symbol: str
    name: str
    exchange: str
    mic_code: Optional[str] = None
    type_: str = Field(alias="type")
    isin: Optional[str] = None


class QuoteData(BaseModel):
    symbol: str
    company_name: str
    current_price: float
    previous_close: float
    open_price: float
    high_price: float
    low_price: float
    change_amount: float
    change_percent: float
    volume: int
    market_cap: Optional[float] = None
    timestamp: datetime


class CompanyProfile(BaseModel):
    symbol: str
    name: str
    description: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    employees: Optional[int] = None
    ipo_date: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None


class EarningsData(BaseModel):
    symbol: str
    report_date: str
    fiscal_date: str
    fiscal_quarter: Optional[int] = None
    eps_estimate: Optional[float] = None
    eps_actual: Optional[float] = None
    eps_surprise: Optional[float] = None
    revenue_estimate: Optional[float] = None
    revenue_actual: Optional[float] = None


class NewsArticle(BaseModel):
    title: str
    description: Optional[str] = None
    url: str
    source: str
    published_at: datetime
    sentiment: Optional[str] = None
    image_url: Optional[str] = None


class CompanyNews(BaseModel):
    symbol: str
    articles: list[NewsArticle]
    total_count: int


class AnalystRating(BaseModel):
    rating: str
    target_price: Optional[float] = None
    price_target_high: Optional[float] = None
    price_target_low: Optional[float] = None
    target_price_average: Optional[float] = None
    recommendation_count: Optional[int] = None


class AnalystSentiment(BaseModel):
    symbol: str
    ratings: list[AnalystRating]
    consensus_rating: Optional[str] = None
    strong_buy: int = 0
    buy: int = 0
    hold: int = 0
    sell: int = 0
    strong_sell: int = 0


class MacroIndicator(BaseModel):
    indicator_name: str
    value: float
    unit: str
    period: str
    timestamp: datetime


class MacroData(BaseModel):
    gdp: Optional[MacroIndicator] = None
    unemployment_rate: Optional[MacroIndicator] = None
    inflation_rate: Optional[MacroIndicator] = None
    interest_rate: Optional[MacroIndicator] = None
    updates_at: datetime


class MarketSnapshot(BaseModel):
    timestamp: datetime
    indices: dict[str, QuoteData]
    most_active: list[QuoteData]
    gainers: list[QuoteData]
    losers: list[QuoteData]
    market_status: str


# Investment thesis schemas
class SentimentType(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class InvestmentThesis(BaseModel):
    id: str
    title: str
    confidence: float = Field(ge=0.0, le=1.0)
    supporting_points: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    sentiment: SentimentType
    provider_id: ProviderId
    model_id: str


class BullishThesis(InvestmentThesis):
    growth_catalysts: list[str] = Field(default_factory=list)
    valuation_opportunities: list[str] = Field(default_factory=list)


class BearishThesis(InvestmentThesis):
    risks: list[str] = Field(default_factory=list)
    valuation_concerns: list[str] = Field(default_factory=list)
    macro_threats: list[str] = Field(default_factory=list)


class ConsensusPoint(BaseModel):
    id: str
    point: str
    supporting_providers: list[ProviderId] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_strength: str = Field(default="moderate")


class Contradiction(BaseModel):
    id: str
    topic: str
    positions: dict[ProviderId, str] = Field(default_factory=dict)
    assumption_conflicts: list[str] = Field(default_factory=list)
    risk_disagreements: list[str] = Field(default_factory=list)


class StockData(BaseModel):
    ticker: str
    price: float
    change_percent: float
    market_cap: Optional[str] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    avg_volume: Optional[str] = None


class NewsItem(BaseModel):
    id: str
    title: str
    url: str
    source: str
    publish_time: str
    sentiment: Sentiment


class ConfidenceScore(BaseModel):
    consensus_agreement: float = Field(ge=0.0, le=1.0)
    bullish_confidence: float = Field(ge=0.0, le=1.0)
    bearish_confidence: float = Field(ge=0.0, le=1.0)


class TickerResearchQuery(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    analysis_type: AnalysisType
    selected_models: list[str] = Field(min_length=1, max_length=8)


class FinancialSynthesisData(BaseModel):
    summary: str = ""
    consensus: list[ConsensusClaim] = Field(default_factory=list)
    disagreements: list[Disagreement] = Field(default_factory=list)
    unique_insights: list[UniqueInsight] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    confidence_score: ConfidenceScore = Field(
        default_factory=lambda: ConfidenceScore(
            consensus_agreement=0.0,
            bullish_confidence=0.0,
            bearish_confidence=0.0,
        )
    )
    investment_thesis: str = ""
    key_risks: list[str] = Field(default_factory=list)
    price_targets: Optional[dict[str, float]] = None
    news_items: list[NewsItem] = Field(default_factory=list)


class FinancialSynthesis(FinancialSynthesisData):
    ticker: str = ""
    company: Optional[CompanyProfile] = None
    bullish_theses: list[BullishThesis] = Field(default_factory=list)
    bearish_theses: list[BearishThesis] = Field(default_factory=list)
    consensus_points: list[ConsensusPoint] = Field(default_factory=list)
    contradictions: list[Contradiction] = Field(default_factory=list)
    investment_score: float = Field(default=0.0, ge=-1.0, le=1.0)
    key_questions: list[str] = Field(default_factory=list)
    next_research_areas: list[str] = Field(default_factory=list)


class FinancialSynthesisOut(IdentifiedModel, FinancialSynthesisData):
    query_id: UUID


class FinancialQueryCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    query: str = Field(min_length=10, max_length=10_000)
    selected_models: list[tuple[ProviderId, str]] = Field(min_length=1, max_length=8)
    include_web_research: bool = False
    focus_areas: Optional[list[str]] = None


class FinancialQueryOut(IdentifiedModel):
    user_id: UUID
    ticker: str
    query: str
    selected_models: list[tuple[str, str]]
    status: str
    error: Optional[str] = None
    completed_at: Optional[datetime] = None


class TickerResearchSummary(BaseModel):
    ticker: str
    stock_data: StockData
    latest_research: Optional[FinancialSynthesisOut] = None
    sentiment: Sentiment


class MarketIndex(BaseModel):
    symbol: str
    name: str
    price: float
    change_percent: float


class TopMover(BaseModel):
    ticker: str
    company_name: str
    price: float
    change_percent: float
    volume: Optional[str] = None


class SectorData(BaseModel):
    sector: str
    change_percent: float
    top_performer: Optional[str] = None


class MarketResearchResult(BaseModel):
    company_analysis: str
    sector_analysis: str
    macro_analysis: str
    key_factors: list[str] = Field(default_factory=list)
    provider_id: ProviderId
    model_id: str


class FinancialResearchResult(BaseModel):
    query: FinancialQueryOut
    synthesis: Optional[FinancialSynthesis] = None
    research_depth: str = Field(default="standard")
    analysis_timestamp: Optional[datetime] = None
