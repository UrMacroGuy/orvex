from __future__ import annotations

import hashlib
import logging
from collections import Counter
from typing import Optional

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.financial import ConsensusPoint
from app.schemas.provider import ProviderId

log = logging.getLogger(__name__)


class ConsensusEngine:
    """Detects agreement across models on investment theses."""

    def __init__(self, *, min_consensus_providers: int = 2) -> None:
        self.min_providers = min_consensus_providers

    def detect(
        self, responses: list[NormalizedResponse], focus_areas: Optional[list[str]] = None
    ) -> list[ConsensusPoint]:
        """Extract consensus claims where models align."""
        if not responses:
            return []

        consensus_terms = self._extract_consensus_terms(responses, focus_areas)
        consensus_points: list[ConsensusPoint] = []

        for term, providers in consensus_terms.items():
            if len(providers) >= self.min_providers:
                confidence = len(providers) / len(responses)
                point = ConsensusPoint(
                    id=self._gen_id(term),
                    point=term,
                    supporting_providers=[ProviderId(p) for p in providers],
                    confidence=min(0.99, confidence),
                    evidence_strength=self._assess_strength(confidence),
                )
                consensus_points.append(point)

        log.info(
            "consensus_detection_complete",
            extra={
                "consensus_points": len(consensus_points),
                "total_responses": len(responses),
            },
        )
        return consensus_points

    @staticmethod
    def _extract_consensus_terms(
        responses: list[NormalizedResponse], focus_areas: Optional[list[str]] = None
    ) -> dict[str, list[str]]:
        """Extract common terms across responses."""
        consensus_keywords = {
            "strong": ["strong position", "market leader", "competitive advantage"],
            "growth": ["growth", "expand", "opportunity", "catalyst"],
            "efficiency": ["efficient", "margin", "profitable", "scale"],
            "solid": ["solid", "stable", "reliable", "consistent"],
            "challenge": ["challenge", "headwind", "pressure", "difficult"],
        }

        if focus_areas:
            consensus_keywords = {
                k: v
                for k, v in consensus_keywords.items()
                if any(area.lower() in k for area in focus_areas)
            }

        term_providers: dict[str, list[str]] = {}

        for response in responses:
            if not response.text:
                continue

            text_lower = response.text.lower()
            for theme, keywords in consensus_keywords.items():
                for keyword in keywords:
                    if keyword in text_lower:
                        term = f"{theme}: {keyword}"
                        if term not in term_providers:
                            term_providers[term] = []
                        term_providers[term].append(response.provider_id)
                        break

        return term_providers

    @staticmethod
    def _assess_strength(confidence: float) -> str:
        """Assess evidence strength from confidence."""
        if confidence >= 0.9:
            return "very_strong"
        elif confidence >= 0.75:
            return "strong"
        elif confidence >= 0.6:
            return "moderate"
        else:
            return "weak"

    @staticmethod
    def _gen_id(term: str) -> str:
        """Generate deterministic ID for consensus point."""
        return hashlib.md5(term.encode()).hexdigest()[:16]
