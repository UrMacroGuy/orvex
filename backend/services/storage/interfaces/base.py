from abc import ABC, abstractmethod
from typing import List, Optional, Any

class BaseRepository(ABC):
    """Abstract base class for all storage repositories."""
    pass

class RawSourceRepository(BaseRepository):
    @abstractmethod
    async def save_source(self, source_data: dict) -> str:
        pass

    @abstractmethod
    async def get_sources(self, filters: Optional[dict] = None) -> List[dict]:
        pass

class SignalRepository(BaseRepository):
    @abstractmethod
    async def save_signal(self, signal_data: dict) -> str:
        pass

    @abstractmethod
    async def get_signals(self, entity_id: str) -> List[dict]:
        pass

class DossierRepository(BaseRepository):
    @abstractmethod
    async def save_dossier(self, dossier_data: dict) -> str:
        pass

    @abstractmethod
    async def get_dossier(self, dossier_id: str) -> Optional[dict]:
        pass

class TimelineRepository(BaseRepository):
    @abstractmethod
    async def save_timeline_event(self, event_data: dict) -> str:
        pass

    @abstractmethod
    async def get_timeline(self, entity_id: str) -> List[dict]:
        pass
