from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class EntityProfile:
    ticker: str
    company_name: str
    sector: str
    country: str
    macro_drivers: List[str]
    keywords: List[str]

class EntityRegistry:
    def __init__(self):
        # Initial canonical registry
        self._registry: Dict[str, EntityProfile] = {
            "VEDL": EntityProfile(
                ticker="VEDL",
                company_name="Vedanta Ltd",
                sector="Metals & Mining",
                country="India",
                macro_drivers=["Commodity Cycles", "Energy Prices", "Infrastructure Spending", "China Demand"],
                keywords=["zinc", "aluminium", "copper", "iron ore", "dividends", "promoter debt", "Hindustan Zinc"]
            ),
            "NVDA": EntityProfile(
                ticker="NVDA",
                company_name="NVIDIA Corporation",
                sector="Technology",
                country="USA",
                macro_drivers=["AI Capex", "Semiconductor Cycle", "Cloud Demand", "Hyperscaler Spending"],
                keywords=["GPU", "Data Center", "AI", "Gaming", "Chips", "Compute"]
            ),
            # Add more as needed, or implement search fallback
        }

    def get_entity(self, ticker: str) -> Optional[EntityProfile]:
        return self._registry.get(ticker.upper())

    def search_entity(self, query: str) -> Optional[EntityProfile]:
        # Simple lookup for now
        return self.get_entity(query)

registry = EntityRegistry()
