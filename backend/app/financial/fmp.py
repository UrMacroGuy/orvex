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


class FMPProvider(BaseFinancialProvider):
    id = "fmp"
    display_name = "Financial Modeling Prep"
    base_url = "https://financialmodelingprep.com/api/v3"

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = FinancialHTTPClient(api_key)

    async def validate_key(self) -> bool:
        """Validate FMP API key."""
        result = await self.client.get(
            f"{self.base_url}/quote/AAPL",
            params={"apikey": self.api_key},
        )
        return result is not None

    async def search_ticker(self, query: str, limit: int = 10) -> list[TickerLookup]:
        """Search for tickers."""
        result = await self.client.get(
            f"{self.base_url}/search",
            params={
                "query": query,
                "limit": limit,
                "apikey": self.api_key,
            },
        )

        if not result:
            return []

        tickers = []
        for item in result[:limit]:
            tickers.append(
                TickerLookup(
                    symbol=item.get("symbol", ""),
                    name=item.get("name", ""),
                    exchange=item.get("exchangeShortName", ""),
                    type=item.get("type", ""),
                )
            )
        return tickers

    async def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """Get quote data."""
        result = await self.client.get(
            f"{self.base_url}/quote/{symbol}",
            params={"apikey": self.api_key},
        )

        if not result or not result:
            return None

        quote = result[0]
        return QuoteData(
            symbol=symbol,
            company_name=quote.get("name", ""),
            current_price=quote.get("price", 0),
            previous_close=quote.get("previousClose", 0),
            open_price=quote.get("open", 0),
            high_price=quote.get("dayHigh", 0),
            low_price=quote.get("dayLow", 0),
            change_amount=quote.get("change", 0),
            change_percent=quote.get("changesPercentage", 0),
            volume=quote.get("volume", 0),
            market_cap=quote.get("marketCap", None),
            timestamp=datetime.now(),
        )

    async def get_company_profile(self, symbol: str) -> Optional[CompanyProfile]:
        """Get company profile."""
        result = await self.client.get(
            f"{self.base_url}/profile/{symbol}",
            params={"apikey": self.api_key},
        )

        if not result or not result:
            return None

        profile = result[0]
        return CompanyProfile(
            symbol=symbol,
            name=profile.get("companyName", ""),
            description=profile.get("description", ""),
            sector=profile.get("sector", ""),
            industry=profile.get("industry", ""),
            website=profile.get("website", ""),
            employees=profile.get("fullTimeEmployees", None),
            ipo_date=profile.get("ipoDate", None),
            market_cap=profile.get("marketCapitalization", None),
            pe_ratio=profile.get("pe", None),
            dividend_yield=profile.get("lastDiv", None),
        )

    async def get_earnings(
        self, symbol: str, limit: int = 8
    ) -> list[EarningsData]:
        """Get earnings dates."""
        result = await self.client.get(
            f"{self.base_url}/earnings-dates",
            params={
                "symbol": symbol,
                "limit": limit,
                "apikey": self.api_key,
            },
        )

        earnings = []
        if result:
            for item in result[:limit]:
                earnings.append(
                    EarningsData(
                        symbol=symbol,
                        report_date=item.get("announcementTime", ""),
                        fiscal_date=item.get("date", ""),
                        eps_estimate=item.get("epsEstimated", None),
                        eps_actual=item.get("eps", None),
                    )
                )

        return earnings

    async def get_news(self, symbol: str, limit: int = 20) -> CompanyNews:
        """Get company news."""
        result = await self.client.get(
            f"{self.base_url}/stock_news",
            params={
                "symbol": symbol,
                "limit": limit,
                "apikey": self.api_key,
            },
        )

        articles = []
        if result:
            for item in result[:limit]:
                try:
                    articles.append(
                        NewsArticle(
                            title=item.get("title", ""),
                            description=item.get("text", ""),
                            url=item.get("url", ""),
                            source=item.get("site", ""),
                            published_at=datetime.fromisoformat(
                                item.get("publishedDate", "").split("T")[0]
                            )
                            if item.get("publishedDate")
                            else datetime.now(),
                            image_url=item.get("image", None),
                        )
                    )
                except (ValueError, TypeError, AttributeError):
                    continue

        return CompanyNews(symbol=symbol, articles=articles, total_count=len(articles))

    async def get_analyst_sentiment(self, symbol: str) -> Optional[AnalystSentiment]:
        """Get analyst estimates."""
        result = await self.client.get(
            f"{self.base_url}/analyst-estimates/{symbol}",
            params={"apikey": self.api_key},
        )

        if not result or not result:
            return None

        estimates = result[0]
        return AnalystSentiment(
            symbol=symbol,
            ratings=[
                AnalystRating(
                    rating="consensus",
                    target_price=estimates.get("priceTargetAverage", None),
                    price_target_high=estimates.get("priceTargetHigh", None),
                    price_target_low=estimates.get("priceTargetLow", None),
                    recommendation_count=estimates.get("numberOfAnalysts", None),
                )
            ],
            consensus_rating=estimates.get("recommendation", None),
        )

    async def get_macro_data(self) -> MacroData:
        """Get macro data."""
        return MacroData(updates_at=datetime.now())

    async def get_market_snapshot(self) -> Optional[MarketSnapshot]:
        """Get market snapshot."""
        return None
