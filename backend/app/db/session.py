from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

_settings = get_settings()

_is_sqlite = _settings.database_url.startswith("sqlite")

_engine_kwargs: dict = {"echo": _settings.db_echo}
if not _is_sqlite:
    _engine_kwargs["pool_size"] = _settings.db_pool_size
    _engine_kwargs["max_overflow"] = _settings.db_max_overflow
    _engine_kwargs["pool_pre_ping"] = True

engine: AsyncEngine = create_async_engine(_settings.database_url, **_engine_kwargs)

SessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def dispose() -> None:
    await engine.dispose()
