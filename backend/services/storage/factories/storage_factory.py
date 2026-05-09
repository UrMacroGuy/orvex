import os
from backend.services.storage.sqlite.web_source_repository import SQLiteRawSourceRepository
from backend.services.storage.session_memory.web_source_repository import InMemoryRawSourceRepository

class StorageFactory:
    @staticmethod
    def get_raw_source_repository(session=None):
        mode = os.getenv("STORAGE_MODE", "sqlite")
        
        if mode == "sqlite":
            if not session:
                raise ValueError("Session required for SQLite storage mode")
            return SQLiteRawSourceRepository(session)
        
        elif mode == "session":
            return InMemoryRawSourceRepository()
            
        else:
            raise ValueError(f"Unknown storage mode: {mode}")
