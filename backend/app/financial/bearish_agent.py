from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.financial import BearishThesis, SentimentType
from app.schemas.provider import ProviderId

log = logging.getLogger(__name__)


class BearishThesisAgent:
    """Extracts bearish investment theses and risks from model responses."""

    def extract(self, responses: list[NormalizedResponse]) -> list[BearishThesis]:
        """Extract risks, valuation concerns, and macro threats."""
        theses: list[BearishThesis] = []

        for response in responses:
            if not response.text:
                continue

            extracted = self._parse_bearish_signals(response)
            theses.extend(extracted)

        deduped = self._deduplicate_theses(theses)
        log.info(
            "bearish_extraction_complete",
            extra={"total": len(theses), "unique": len(deduped)},
        )
        return deduped

    @staticmethod
    def _parse_bearish_signals(response: NormalizedResponse) -> list[BearishThesis]:
        """Parse bearish signals from response text."""
        if not response.text:
            return []

        text = response.text.lower()
        theses: list[BearishThesis] = []

        bearish_signals = {
            "execution risk": (
                ["execution risk", "management turnover", "track record"],
                0.75,
            ),
            "valuation concern": (
                [
                    "overvalued",
                    "expensive",
                    "premium",
                    "stretched valuation",
                    "pe ratio",
                ],
                0.8,
            ),
            "competitive pressure": (
                ["competition", "market share loss", "pricing pressure", "disruption"],
                0.85,
            ),
            "macro headwind": (
                [
                    "recession",
                    "interest rate",
                    "inflation",
                    "geopolitical",
                    "currency",
                ],
                0.8,
            ),
            "regulatory risk": (
                ["regulation", "compliance", "antitrust", "legal"],
                0.75,
            ),
        }

        for thesis_name, (patterns, confidence) in bearish_signals.items():
            for pattern in patterns:
                if pattern in text:
                    thesis = BearishThesis(
                        id=BearishThesisAgent._gen_id(thesis_name, response.model_id),
                        title=thesis_name,
                        confidence=confidence,
                        supporting_points=[pattern.title()],
                        sources=[],
                        sentiment=SentimentType.BEARISH,
                        risks=[pattern.title()],
                        valuation_concerns=[],
                        macro_threats=[],
                        provider_id=ProviderId(response.provider_id),
                        model_id=response.model_id,
                    )
                    theses.append(thesis)
                    break

        return theses

    @staticmethod
    def _deduplicate_theses(
        theses: list[BearishThesis],
    ) -> list[BearishThesis]:
        """Remove duplicate or similar theses."""
        seen: dict[str, BearishThesis] = {}

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
