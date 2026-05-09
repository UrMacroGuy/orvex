from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.models.web_source import WebSource
from sqlalchemy import select
from backend.services.storage.interfaces.repository_protocols import RawSourceRepository

class SQLiteRawSourceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_source(self, source_data: dict) -> str:
        source = WebSource(**source_data)
        self.session.add(source)
        await self.session.commit()
        return str(source.id)

    async def get_sources(self, filters: Optional[dict] = None) -> List[dict]:
        stmt = select(WebSource)
        # Apply filters if needed...
        result = await self.session.execute(stmt)
        sources = result.scalars().all()
        return [s.__dict__ for s in sources]
