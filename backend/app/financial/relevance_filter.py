from typing import List
from app.orchestration.normalizer import NormalizedResponse
from .registry import EntityProfile

class RelevanceFilter:
    """Filters and scores raw responses based on entity grounding."""

    @staticmethod
    def filter_responses(responses: List[NormalizedResponse], entity: EntityProfile) -> List[NormalizedResponse]:
        """Score each response and return only relevant ones."""
        if not entity:
            return responses

        filtered = []
        for res in responses:
            if RelevanceFilter._is_relevant(res, entity):
                filtered.append(res)
        
        return filtered

    @staticmethod
    def _is_relevant(res: NormalizedResponse, entity: EntityProfile) -> bool:
        """Score content and return true if above relevance threshold."""
        content = (res.content or "").lower()
        score = 0
        threshold = 30

        # Positive signals
        if entity.ticker.lower() in content: score += 40
        if entity.company_name.lower() in content: score += 40
        
        for kw in entity.keywords:
            if kw.lower() in content: score += 25
        
        for driver in entity.macro_drivers:
            if driver.lower() in content: score += 20
        
        # Negative signals (Noise)
        noise_signals = [
            ("ai", 60), ("semiconductor", 60), ("datacenter", 60), 
            ("nvidia", 60), ("hyperscaler", 50), ("cloud infrastructure", 50)
        ]
        
        for signal, penalty in noise_signals:
            if signal in content:
                score -= penalty
        
        return score >= threshold
