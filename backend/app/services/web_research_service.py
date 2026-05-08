from __future__ import annotations

from app.schemas.synthesis import WebSource


class WebResearchService:
    """Stub web research provider. Returns no sources by default."""

    async def search(self, query: str, *, max_results: int = 6) -> list[WebSource]:
        return []
