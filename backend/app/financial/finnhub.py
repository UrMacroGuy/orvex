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
    MacroIndicator,
    MarketSnapshot,
    NewsArticle,
    QuoteData,
    TickerLookup,
)


class FinnhubProvider(BaseFinancialProvider):
    id = "finnhub"
    display_name = "Finnhub"
    base_url = "https://finnhub.io/api/v1"

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = FinancialHTTPClient(api_key)

    async def validate_key(self) -> bool:
        """Validate Finnhub API key."""
        result = await self.client.get(
            f"{self.base_url}/quote",
            params={"symbol": "AAPL", "token": self.api_key},
        )
        return result is not None

    async def search_ticker(self, query: str, limit: int = 10) -> list[TickerLookup]:
        """Search for tickers by symbol or name."""
        result = await self.client.get(
            f"{self.base_url}/search",
            params={"q": query, "token": self.api_key},
        )

        if not result or "result" not in result:
            return []

        tickers = []
        for item in result["result"][:limit]:
            tickers.append(
                TickerLookup(
                    symbol=item.get("symbol", ""),
                    name=item.get("description", ""),
                    exchange=item.get("displaySymbol", ""),
                    type=item.get("type", ""),
                )
            )
        return tickers

    async def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """Get current price quote."""
        result = await self.client.get(
            f"{self.base_url}/quote",
            params={"symbol": symbol, "token": self.api_key},
        )

        if not result or "c" not in result:
            return None

        return QuoteData(
            symbol=symbol,
            company_name=symbol,
            current_price=result.get("c", 0),
            previous_close=result.get("pc", 0),
            open_price=result.get("o", 0),
            high_price=result.get("h", 0),
            low_price=result.get("l", 0),
            change_amount=result.get("c", 0) - result.get("pc", 0),
            change_percent=(
                ((result.get("c", 0) - result.get("pc", 0)) / result.get("pc", 1))
                * 100
            ),
            volume=result.get("v", 0),
            timestamp=datetime.now(),
        )

    async def get_company_profile(self, symbol: str) -> Optional[CompanyProfile]:
        """Get company profile."""
        result = await self.client.get(
            f"{self.base_url}/stock/profile2",
            params={"symbol": symbol, "token": self.api_key},
        )

        if not result:
            return None

        return CompanyProfile(
            symbol=symbol,
            name=result.get("name", ""),
            description=result.get("finnhubIndustry", ""),
            sector=result.get("finnhubIndustry", ""),
            industry=result.get("finnhubIndustry", ""),
            website=result.get("weburl", ""),
            employees=result.get("employees", None),
            ipo_date=result.get("ipo", None),
            market_cap=result.get("marketCapitalization", None),
            pe_ratio=result.get("shareOutstanding", None),
        )

    async def get_earnings(
        self, symbol: str, limit: int = 8
    ) -> list[EarningsData]:
        """Get earnings calendar data."""
        result = await self.client.get(
            f"{self.base_url}/calendar/earnings",
            params={"symbol": symbol, "token": self.api_key},
        )

        if not result or "earnings" not in result:
            return []

        earnings = []
        for item in result["earnings"][:limit]:
            earnings.append(
                EarningsData(
                    symbol=symbol,
                    report_date=item.get("date", ""),
                    fiscal_date=item.get("quarter", ""),
                    eps_estimate=item.get("epsEstimate", None),
                    eps_actual=item.get("epsActual", None),
                    eps_surprise=item.get("epsSurprise", None),
                    revenue_estimate=item.get("revenueEstimate", None),
                    revenue_actual=item.get("revenue", None),
                )
            )
        return earnings

    async def get_news(self, symbol: str, limit: int = 20) -> CompanyNews:
        """Get company news."""
        result = await self.client.get(
            f"{self.base_url}/company-news",
            params={
                "symbol": symbol,
                "from": "2024-01-01",
                "to": "2025-12-31",
                "token": self.api_key,
            },
        )

        articles = []
        if result:
            for item in result[:limit]:
                try:
                    articles.append(
                        NewsArticle(
                            title=item.get("headline", ""),
                            description=item.get("summary", ""),
                            url=item.get("url", ""),
                            source=item.get("source", "Unknown"),
                            published_at=datetime.fromtimestamp(
                                item.get("datetime", 0)
                            ),
                            image_url=item.get("image", None),
                        )
                    )
                except (ValueError, TypeError):
                    continue

        return CompanyNews(symbol=symbol, articles=articles, total_count=len(articles))

    async def get_analyst_sentiment(self, symbol: str) -> Optional[AnalystSentiment]:
        """Get analyst ratings and sentiment."""
        result = await self.client.get(
            f"{self.base_url}/stock/recommendation",
            params={"symbol": symbol, "token": self.api_key},
        )

        if not result:
            return None

        latest = result[0] if result else {}

        return AnalystSentiment(
            symbol=symbol,
            ratings=[
                AnalystRating(
                    rating="consensus",
                    target_price=latest.get("targetPrice", None),
                    recommendation_count=latest.get("numberOfAnalysts", None),
                )
            ],
            strong_buy=latest.get("strongBuy", 0),
            buy=latest.get("buy", 0),
            hold=latest.get("hold", 0),
            sell=latest.get("sell", 0),
            strong_sell=latest.get("strongSell", 0),
        )

    async def get_macro_data(self) -> MacroData:
        """Get macroeconomic data."""
        result = await self.client.get(
            f"{self.base_url}/economic",
            params={"token": self.api_key},
        )

        macro_data = MacroData(updates_at=datetime.now())

        if result:
            for item in result:
                indicator = item.get("label", "").lower()
                value = item.get("actual", 0)
                if "gdp" in indicator:
                    macro_data.gdp = MacroIndicator(
                        indicator_name="GDP",
                        value=value,
                        unit="USD Billions",
                        period=item.get("period", ""),
                        timestamp=datetime.now(),
                    )
                elif "unemployment" in indicator:
                    macro_data.unemployment_rate = MacroIndicator(
                        indicator_name="Unemployment Rate",
                        value=value,
                        unit="%",
                        period=item.get("period", ""),
                        timestamp=datetime.now(),
                    )
                elif "inflation" in indicator or "cpi" in indicator:
                    macro_data.inflation_rate = MacroIndicator(
                        indicator_name="Inflation Rate",
                        value=value,
                        unit="%",
                        period=item.get("period", ""),
                        timestamp=datetime.now(),
                    )

        return macro_data

    async def get_market_snapshot(self) -> Optional[MarketSnapshot]:
        """Get market snapshot with indices and movers."""
        indices = {}
        major_indices = ["^GSPC", "^DJI", "^IXIC"]

        for idx in major_indices:
            quote = await self.get_quote(idx)
            if quote:
                indices[idx] = quote

        return MarketSnapshot(
            timestamp=datetime.now(),
            indices=indices,
            most_active=[],
            gainers=[],
            losers=[],
            market_status="open",
        )
