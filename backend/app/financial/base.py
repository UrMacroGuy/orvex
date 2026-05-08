from __future__ import annotations

from abc import ABC, abstractmethod
from typing import ClassVar, Optional

from app.schemas.financial import (
    AnalystSentiment,
    CompanyNews,
    CompanyProfile,
    EarningsData,
    MacroData,
    MarketSnapshot,
    QuoteData,
    TickerLookup,
)


class BaseFinancialProvider(ABC):
    id: ClassVar[str]
    display_name: ClassVar[str]
    base_url: ClassVar[str]

    def __init__(self, api_key: str):
        self.api_key = api_key

    @abstractmethod
    async def validate_key(self) -> bool:
        """Validate API key connectivity."""
        ...

    @abstractmethod
    async def search_ticker(self, query: str, limit: int = 10) -> list[TickerLookup]:
        """Search for tickers by symbol or name."""
        ...

    @abstractmethod
    async def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """Get current price quote for a symbol."""
        ...

    @abstractmethod
    async def get_company_profile(self, symbol: str) -> Optional[CompanyProfile]:
        """Get company fundamental information."""
        ...

    @abstractmethod
    async def get_earnings(
        self, symbol: str, limit: int = 8
    ) -> list[EarningsData]:
        """Get recent earnings data."""
        ...

    @abstractmethod
    async def get_news(self, symbol: str, limit: int = 20) -> CompanyNews:
        """Get latest news for a company."""
        ...

    @abstractmethod
    async def get_analyst_sentiment(self, symbol: str) -> Optional[AnalystSentiment]:
        """Get analyst ratings and sentiment."""
        ...

    @abstractmethod
    async def get_macro_data(self) -> MacroData:
        """Get macroeconomic indicators."""
        ...

    @abstractmethod
    async def get_market_snapshot(self) -> Optional[MarketSnapshot]:
        """Get overall market snapshot."""
        ...
