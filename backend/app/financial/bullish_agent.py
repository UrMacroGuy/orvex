from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.financial import BullishThesis, SentimentType
from app.schemas.provider import ProviderId

log = logging.getLogger(__name__)


class BullishThesisAgent:
    """Extracts bullish investment theses from model responses."""

    def extract(self, responses: list[NormalizedResponse]) -> list[BullishThesis]:
        """Extract bullish signals and growth catalysts."""
        theses: list[BullishThesis] = []

        for response in responses:
            if not response.text:
                continue

            extracted = self._parse_bullish_signals(response)
            theses.extend(extracted)

        deduped = self._deduplicate_theses(theses)
        log.info(
            "bullish_extraction_complete",
            extra={"total": len(theses), "unique": len(deduped)},
        )
        return deduped

    @staticmethod
    def _parse_bullish_signals(response: NormalizedResponse) -> list[BullishThesis]:
        """Parse bullish signals from response text."""
        if not response.text:
            return []

        text = response.text.lower()
        theses: list[BullishThesis] = []

        bullish_signals = {
            "growth catalyst": (
                ["growth catalyst", "expansion", "new market", "product launch"],
                0.85,
            ),
            "valuation opportunity": (
                ["undervalued", "discount", "cheap", "upside", "high margin"],
                0.75,
            ),
            "operational excellence": (
                ["efficiency", "innovation", "scale", "margin expansion"],
                0.8,
            ),
            "market leadership": (
                ["market leader", "dominant position", "competitive moat"],
                0.9,
            ),
        }

        for thesis_name, (patterns, confidence) in bullish_signals.items():
            for pattern in patterns:
                if pattern in text:
                    thesis = BullishThesis(
                        id=BullishThesisAgent._gen_id(thesis_name, response.model_id),
                        title=thesis_name,
                        confidence=confidence,
                        supporting_points=[pattern.title()],
                        sources=[],
                        sentiment=SentimentType.BULLISH,
                        growth_catalysts=[pattern.title()],
                        valuation_opportunities=[],
                        provider_id=ProviderId(response.provider_id),
                        model_id=response.model_id,
                    )
                    theses.append(thesis)
                    break

        return theses

    @staticmethod
    def _deduplicate_theses(
        theses: list[BullishThesis],
    ) -> list[BullishThesis]:
        """Remove duplicate or similar theses."""
        seen: dict[str, BullishThesis] = {}

        for thesis in theses:
            key = thesis.title.lower()
            if key not in seen:
                seen[key] = thesis
            else:
                existing = seen[key]
                if thesis.confidence > existing.confidence:
                    seen[key] = thesis

        return list(seen.values())

    @staticmethod
    def _gen_id(thesis_name: str, model_id: str) -> str:
        """Generate deterministic ID for thesis."""
        combined = f"{thesis_name}:{model_id}".encode()
        return hashlib.md5(combined).hexdigest()[:16]
