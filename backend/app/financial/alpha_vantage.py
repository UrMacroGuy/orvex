from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.financial.base import BaseFinancialProvider
from app.financial.http import FinancialHTTPClient
from app.schemas.financial import (
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


class AlphaVantageProvider(BaseFinancialProvider):
    id = "alpha_vantage"
    display_name = "Alpha Vantage"
    base_url = "https://www.alphavantage.co/query"

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = FinancialHTTPClient(api_key)

    async def validate_key(self) -> bool:
        """Validate Alpha Vantage API key."""
        result = await self.client.get(
            self.base_url,
            params={
                "function": "GLOBAL_QUOTE",
                "symbol": "AAPL",
                "apikey": self.api_key,
            },
        )
        return result is not None and "Global Quote" in result

    async def search_ticker(self, query: str, limit: int = 10) -> list[TickerLookup]:
        """Search for tickers."""
        result = await self.client.get(
            self.base_url,
            params={
                "function": "SYMBOL_SEARCH",
                "keywords": query,
                "apikey": self.api_key,
            },
        )

        if not result or "bestMatches" not in result:
            return []

        tickers = []
        for item in result["bestMatches"][:limit]:
            tickers.append(
                TickerLookup(
                    symbol=item.get("1. symbol", ""),
                    name=item.get("2. name", ""),
                    exchange=item.get("4. region", ""),
                    type=item.get("3. type", ""),
                )
            )
        return tickers

    async def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """Get global quote."""
        result = await self.client.get(
            self.base_url,
            params={
                "function": "GLOBAL_QUOTE",
                "symbol": symbol,
                "apikey": self.api_key,
            },
        )

        if not result or "Global Quote" not in result:
            return None

        quote = result["Global Quote"]
        if not quote or "05. price" not in quote:
            return None

        price = float(quote.get("05. price", 0))
        prev_close = float(quote.get("08. previous close", 0))

        return QuoteData(
            symbol=symbol,
            company_name=symbol,
            current_price=price,
            previous_close=prev_close,
            open_price=float(quote.get("02. open", 0)),
            high_price=float(quote.get("03. high", 0)),
            low_price=float(quote.get("04. low", 0)),
            change_amount=price - prev_close,
            change_percent=float(quote.get("10. change percent", "0").rstrip("%")),
            volume=int(quote.get("06. volume", 0)),
            timestamp=datetime.now(),
        )

    async def get_company_profile(self, symbol: str) -> Optional[CompanyProfile]:
        """Get company overview."""
        result = await self.client.get(
            self.base_url,
            params={
                "function": "OVERVIEW",
                "symbol": symbol,
                "apikey": self.api_key,
            },
        )

        if not result or not result.get("Symbol"):
            return None

        return CompanyProfile(
            symbol=symbol,
            name=result.get("Name", ""),
            description=result.get("Description", ""),
            sector=result.get("Sector", ""),
            industry=result.get("Industry", ""),
            website=result.get("Website", ""),
            employees=int(result.get("FullTimeEmployees", 0)) or None,
            ipo_date=result.get("IPODate", None),
            market_cap=int(result.get("MarketCapitalization", 0)) or None,
            pe_ratio=float(result.get("PERatio", 0)) or None,
            dividend_yield=float(result.get("DividendYield", 0)) or None,
        )

    async def get_earnings(
        self, symbol: str, limit: int = 8
    ) -> list[EarningsData]:
        """Get earnings calendar."""
        result = await self.client.get(
            self.base_url,
            params={
                "function": "EARNINGS",
                "symbol": symbol,
                "apikey": self.api_key,
            },
        )

        earnings = []
        if result and "quarterlyEarnings" in result:
            for item in result["quarterlyEarnings"][:limit]:
                try:
                    earnings.append(
                        EarningsData(
                            symbol=symbol,
                            report_date=item.get("reportedDate", ""),
                            fiscal_date=item.get("fiscalDateEnding", ""),
                            eps_estimate=float(item.get("estimatedEPS", 0)) or None,
                            eps_actual=float(item.get("reportedEPS", 0)) or None,
                        )
                    )
                except (ValueError, TypeError):
                    continue

        return earnings

    async def get_news(self, symbol: str, limit: int = 20) -> CompanyNews:
        """Get news articles."""
        return CompanyNews(symbol=symbol, articles=[], total_count=0)

    async def get_analyst_sentiment(self, symbol: str) -> Optional[AnalystSentiment]:
        """Get analyst sentiment."""
        return None

    async def get_macro_data(self) -> MacroData:
        """Get macro data."""
        return MacroData(updates_at=datetime.now())

    async def get_market_snapshot(self) -> Optional[MarketSnapshot]:
        """Get market snapshot."""
        return None
