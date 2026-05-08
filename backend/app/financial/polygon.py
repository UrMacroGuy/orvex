from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.financial.base import BaseFinancialProvider
from app.financial.http import FinancialHTTPClient
from app.schemas.financial import (
    AnalystRating,
    AnalystSentiment,
    CompanyNews,
    CompanyProfile,
    EarningsData,
    MacroData,
    MarketSnapshot,
    NewsArticle,
    QuoteData,
    TickerLookup,
)


class PolygonProvider(BaseFinancialProvider):
    id = "polygon"
    display_name = "Polygon.io"
    base_url = "https://api.polygon.io"

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = FinancialHTTPClient(api_key)

    async def validate_key(self) -> bool:
        """Validate Polygon API key."""
        result = await self.client.get(
            f"{self.base_url}/v3/quotes/AAPL",
            params={"apikey": self.api_key},
        )
        return result is not None

    async def search_ticker(self, query: str, limit: int = 10) -> list[TickerLookup]:
        """Search for tickers."""
        result = await self.client.get(
            f"{self.base_url}/v3/reference/tickers",
            params={
                "search": query,
                "limit": limit,
                "apikey": self.api_key,
            },
        )

        if not result or "results" not in result:
            return []

        tickers = []
        for item in result["results"]:
            tickers.append(
                TickerLookup(
                    symbol=item.get("ticker", ""),
                    name=item.get("name", ""),
                    exchange=item.get("primary_exchange", ""),
                    type=item.get("type", ""),
                    isin=item.get("figi", ""),
                )
            )
        return tickers

    async def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """Get latest quote."""
        result = await self.client.get(
            f"{self.base_url}/v3/quotes/{symbol}",
            params={"apikey": self.api_key},
        )

        if not result or "results" not in result:
            return None

        quote = result["results"]
        return QuoteData(
            symbol=symbol,
            company_name=symbol,
            current_price=quote.get("last_quote", {}).get("ask", 0),
            previous_close=quote.get("last_updated", 0),
            open_price=quote.get("last_trade", {}).get("price", 0),
            high_price=quote.get("last_trade", {}).get("price", 0),
            low_price=quote.get("last_trade", {}).get("price", 0),
            change_amount=0,
            change_percent=0,
            volume=0,
            timestamp=datetime.now(),
        )

    async def get_company_profile(self, symbol: str) -> Optional[CompanyProfile]:
        """Get company details."""
        result = await self.client.get(
            f"{self.base_url}/v3/reference/tickers/{symbol}",
            params={"apikey": self.api_key},
        )

        if not result or "results" not in result:
            return None

        data = result["results"]
        return CompanyProfile(
            symbol=symbol,
            name=data.get("name", ""),
            description=data.get("description", ""),
            sector=data.get("sic_description", ""),
            industry=data.get("sic_description", ""),
            website=data.get("homepage_url", ""),
            employees=data.get("total_employees", None),
            ipo_date=data.get("listed_date", None),
        )

    async def get_earnings(
        self, symbol: str, limit: int = 8
    ) -> list[EarningsData]:
        """Get earnings reports."""
        result = await self.client.get(
            f"{self.base_url}/vX/reference/financials",
            params={
                "ticker": symbol,
                "limit": limit,
                "apikey": self.api_key,
            },
        )

        if not result or "results" not in result:
            return []

        earnings = []
        for item in result["results"]:
            earnings.append(
                EarningsData(
                    symbol=symbol,
                    report_date=item.get("filing_date", ""),
                    fiscal_date=item.get("period_of_report_date", ""),
                    eps_estimate=None,
                    eps_actual=None,
                )
            )
        return earnings

    async def get_news(self, symbol: str, limit: int = 20) -> CompanyNews:
        """Get news articles."""
        result = await self.client.get(
            f"{self.base_url}/v2/reference/news",
            params={
                "ticker": symbol,
                "limit": limit,
                "apikey": self.api_key,
            },
        )

        articles = []
        if result and "results" in result:
            for item in result["results"]:
                articles.append(
                    NewsArticle(
                        title=item.get("title", ""),
                        description=item.get("description", ""),
                        url=item.get("article_url", ""),
                        source=item.get("publisher", {}).get("name", ""),
                        published_at=datetime.fromisoformat(
                            item.get("published_utc", "").replace("Z", "+00:00")
                        ),
                        image_url=item.get("image_url", None),
                    )
                )

        return CompanyNews(symbol=symbol, articles=articles, total_count=len(articles))

    async def get_analyst_sentiment(self, symbol: str) -> Optional[AnalystSentiment]:
        """Get analyst ratings."""
        return AnalystSentiment(
            symbol=symbol,
            ratings=[],
            consensus_rating=None,
        )

    async def get_macro_data(self) -> MacroData:
        """Get macro data."""
        return MacroData(updates_at=datetime.now())

    async def get_market_snapshot(self) -> Optional[MarketSnapshot]:
        """Get market snapshot."""
        return None
