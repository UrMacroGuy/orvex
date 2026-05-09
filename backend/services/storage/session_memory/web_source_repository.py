from typing import List, Optional, Dict
from uuid import uuid4
from datetime import datetime

class InMemoryRawSourceRepository:
    def __init__(self):
        self._storage: Dict[str, dict] = {}

    async def save_source(self, source_data: dict) -> str:
        source_id = str(uuid4())
        source_data["id"] = source_id
        source_data["created_at"] = datetime.now()
        self._storage[source_id] = source_data
        return source_id

    async def get_sources(self, filters: Optional[dict] = None) -> List[dict]:
        # Simple implementation without filtering for now
        return list(self._storage.values())
