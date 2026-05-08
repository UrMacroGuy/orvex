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
        """Check if content is relevant to the entity."""
        content = (res.content or "").lower()
        
        # Check for direct entity matches
        if entity.ticker.lower() in content or entity.company_name.lower() in content:
            return True
        
        # Check for keyword matches
        for kw in entity.keywords:
            if kw.lower() in content:
                return True
        
        # Check for macro driver matches (partial match)
        for driver in entity.macro_drivers:
            if driver.lower() in content:
                return True
                
        return False
