
from typing import Optional, ClassVar
import yfinance as yf
from app.financial.base import BaseFinancialProvider
from app.schemas.financial import (
    QuoteData,
    TickerLookup,
    CompanyProfile,
    EarningsData,
    CompanyNews,
    AnalystSentiment,
    MacroData,
    MarketSnapshot,
)

class YahooFinanceProvider(BaseFinancialProvider):
    id: ClassVar[str] = "yahoo"
    display_name: ClassVar[str] = "Yahoo Finance"
    base_url: ClassVar[str] = "https://query1.finance.yahoo.com"

    async def validate_key(self) -> bool:
        # Yahoo Finance doesn't strictly require an API key for most data.
        return True

    async def search_ticker(self, query: str, limit: int = 10) -> list[TickerLookup]:
        # Implement using yfinance search
        return []

    async def get_quote(self, symbol: str) -> Optional[QuoteData]:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return QuoteData(
            symbol=symbol,
            current_price=info.get("currentPrice") or info.get("regularMarketPrice"),
            change_percent=info.get("regularMarketChangePercent"),
            volume=info.get("regularMarketVolume"),
            high_price=info.get("dayHigh"),
            low_price=info.get("dayLow"),
        )

    async def get_company_profile(self, symbol: str) -> Optional[CompanyProfile]:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return CompanyProfile(
            symbol=symbol,
            company_name=info.get("longName"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            description=info.get("longBusinessSummary"),
        )

    async def get_earnings(self, symbol: str, limit: int = 8) -> list[EarningsData]:
        return []

    async def get_news(self, symbol: str, limit: int = 20) -> CompanyNews:
        return CompanyNews(articles=[])

    async def get_analyst_sentiment(self, symbol: str) -> Optional[AnalystSentiment]:
        return None

    async def get_macro_data(self) -> MacroData:
        return MacroData(indicators={})

    async def get_market_snapshot(self) -> Optional[MarketSnapshot]:
        return None
