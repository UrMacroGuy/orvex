from typing import List, Optional
from dataclasses import dataclass
from app.orchestration.normalizer import NormalizedResponse
from .registry import EntityProfile

@dataclass
class ScoredResponse:
    response: NormalizedResponse
    entity_score: float = 0.0
    sector_score: float = 0.0
    country_score: float = 0.0
    intent_score: float = 0.0
    authority_score: float = 0.0
    causality_score: float = 0.0

    @property
    def total_score(self) -> float:
        return (
            self.entity_score + 
            self.sector_score + 
            self.country_score + 
            self.intent_score + 
            self.authority_score +
            self.causality_score
        )

class RelevanceFilter:
    """Filters and scores raw responses based on multidimensional alignment."""

    # Authority map
    PROVIDER_AUTHORITY = {
        "sec": 100.0,
        "fred": 100.0,
        "yahoo": 50.0,
        "openai": 30.0,
        "gemini": 30.0,
        "anthropic": 30.0,
        "reddit": 10.0,
    }

    @staticmethod
    def score_responses(responses: List[NormalizedResponse], profile: Optional[EntityProfile], intent: str) -> List[ScoredResponse]:
        scored = []
        for res in responses:
            scored.append(RelevanceFilter._score_response(res, profile, intent))

        # Filter out extremely noisy responses (low total score)
        return sorted([s for s in scored if s.total_score > 20.0], key=lambda x: x.total_score, reverse=True)

    @staticmethod
    def _score_response(res: NormalizedResponse, profile: Optional[EntityProfile], intent: str) -> ScoredResponse:
        content = (res.text or "").lower()
        scores = ScoredResponse(res)

        # Authority score
        scores.authority_score = RelevanceFilter.PROVIDER_AUTHORITY.get(res.provider_id.lower(), 20.0)

        if profile:
            # Entity Score
            if profile.ticker.lower() in content or profile.company_name.lower() in content:
                scores.entity_score = 60.0
            # Additional entity keywords
            for kw in profile.keywords:
                if kw.lower() in content:
                    scores.entity_score += 5.0

            # Sector Score
            if profile.sector.lower() in content:
                scores.sector_score = 40.0

            # Country Score
            if profile.country.lower() in content:
                scores.country_score = 30.0

            # Macro drivers
            for driver in profile.macro_drivers:
                if driver.lower() in content:
                    scores.causality_score += 10.0

        # Intent Score
        if intent.lower() in content:
            scores.intent_score = 50.0

        return scores
