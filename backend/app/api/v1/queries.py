from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from typing import Annotated

from app.api.deps import CurrentUser, CurrentUserDep, QueryServiceDep
from app.core.security import JWTError, verify_jwt
from app.schemas.common import CursorPage, Envelope, Meta
from app.schemas.query import QueryCreate, QueryOut
from app.schemas.synthesis import FullQueryResult


async def get_stream_user(
    authorization: Annotated[str | None, Header()] = None,
    token: str | None = Query(default=None),
) -> CurrentUser:
    raw = None
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization.split(None, 1)[1].strip()
    elif token:
        raw = token
    if not raw:
        raise HTTPException(status_code=401, detail="missing bearer token")
    try:
        user_id = verify_jwt(raw)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"invalid token: {e}")
    return CurrentUser(id=user_id)


StreamUserDep = Annotated[CurrentUser, Depends(get_stream_user)]

router = APIRouter(prefix="/queries", tags=["queries"])


@router.post(
    "",
    response_model=Envelope[QueryOut],
    status_code=status.HTTP_201_CREATED,
)
async def create_query(
    payload: QueryCreate,
    user: CurrentUserDep,
    service: QueryServiceDep,
) -> Envelope[QueryOut]:
    created = await service.create(user_id=user.id, payload=payload)
    return Envelope(data=created)


@router.get("", response_model=Envelope[CursorPage[QueryOut]])
async def list_queries(
    user: CurrentUserDep,
    service: QueryServiceDep,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> Envelope[CursorPage[QueryOut]]:
    items, next_cursor = await service.list(
        user_id=user.id, cursor=cursor, limit=limit
    )
    return Envelope(
        data=CursorPage(items=items, next_cursor=next_cursor),
        meta=Meta(next_cursor=next_cursor),
    )


@router.get("/{query_id}", response_model=Envelope[FullQueryResult])
async def get_query(
    query_id: UUID,
    user: CurrentUserDep,
    service: QueryServiceDep,
) -> Envelope[FullQueryResult]:
    result = await service.get(user_id=user.id, query_id=query_id)
    return Envelope(data=result)


@router.get("/{query_id}/stream")
async def stream_query(
    query_id: UUID,
    user: StreamUserDep,
    service: QueryServiceDep,
) -> StreamingResponse:
    async def _gen():
        async for event in service.stream(user_id=user.id, query_id=query_id):
            yield f"event: {event.type.value}\ndata: {event.model_dump_json()}\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
