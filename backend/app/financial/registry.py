from __future__ import annotations

from typing import Optional

from app.financial.alpha_vantage import AlphaVantageProvider
from app.financial.base import BaseFinancialProvider
from app.financial.finnhub import FinnhubProvider
from app.financial.fmp import FMPProvider
from app.financial.polygon import PolygonProvider


class FinancialProviderRegistry:
    def __init__(self):
        self._providers: dict[str, type[BaseFinancialProvider]] = {
            "finnhub": FinnhubProvider,
            "polygon": PolygonProvider,
            "alpha_vantage": AlphaVantageProvider,
            "fmp": FMPProvider,
        }

    def get(self, provider_id: str, api_key: str) -> Optional[BaseFinancialProvider]:
        """Get a provider instance."""
        provider_class = self._providers.get(provider_id)
        if provider_class:
            return provider_class(api_key)
        return None

    def list_providers(self) -> list[str]:
        """List all available provider IDs."""
        return list(self._providers.keys())

    def register(
        self, provider_id: str, provider_class: type[BaseFinancialProvider]
    ) -> None:
        """Register a new financial provider."""
        self._providers[provider_id] = provider_class

    def all(self) -> dict[str, type[BaseFinancialProvider]]:
        """Get all registered providers."""
        return self._providers.copy()


# Global registry instance
registry = FinancialProviderRegistry()


def build_default_registry() -> FinancialProviderRegistry:
    """Build a new registry with default providers."""
    return FinancialProviderRegistry()
