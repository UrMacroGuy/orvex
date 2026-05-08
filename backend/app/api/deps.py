from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import JWTError, verify_jwt
from app.db.session import get_session
from app.services.key_service import KeyService
from app.services.provider_service import ProviderService
from app.services.query_service import QueryService


@dataclass(slots=True)
class CurrentUser:
    id: UUID


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(None, 1)[1].strip()
    try:
        user_id = verify_jwt(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"invalid token: {e}")
    return CurrentUser(id=user_id)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_query_service(session: DbSession) -> QueryService:
    return QueryService(session)


async def get_key_service(session: DbSession) -> KeyService:
    return KeyService(session)


async def get_provider_service() -> ProviderService:
    return ProviderService()


QueryServiceDep = Annotated[QueryService, Depends(get_query_service)]
KeyServiceDep = Annotated[KeyService, Depends(get_key_service)]
ProviderServiceDep = Annotated[ProviderService, Depends(get_provider_service)]
