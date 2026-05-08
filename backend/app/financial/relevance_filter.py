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

    @property
    def total_score(self) -> float:
        return self.entity_score + self.sector_score + self.country_score + self.intent_score + self.authority_score

class RelevanceFilter:
    """Filters and scores raw responses based on multidimensional alignment."""

    @staticmethod
    def score_responses(responses: List[NormalizedResponse], profile: EntityProfile, intent: str) -> List[ScoredResponse]:
        scored = []
        for res in responses:
            scored.append(RelevanceFilter._score_response(res, profile, intent))
        
        # Sort by total_score descending
        return sorted([s for s in scored if s.total_score > 0], key=lambda x: x.total_score, reverse=True)

    @staticmethod
    def _score_response(res: NormalizedResponse, profile: EntityProfile, intent: str) -> ScoredResponse:
        content = (res.content or "").lower()
        scores = ScoredResponse(res)

        # Entity Score
        if profile.ticker.lower() in content or profile.company_name.lower() in content:
            scores.entity_score = 50.0

        # Sector Score
        if profile.sector.lower() in content:
            scores.sector_score = 30.0

        # Country Score
        if profile.country.lower() in content:
            scores.country_score = 20.0

        # Intent Score (Simple mapping)
        if intent.lower() in content:
            scores.intent_score = 40.0
            
        return scores
