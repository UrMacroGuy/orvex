from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUserDep, KeyServiceDep
from app.schemas.common import Envelope
from app.schemas.provider import ApiKeyCreate, ApiKeyOut

router = APIRouter(prefix="/keys", tags=["keys"])


@router.post(
    "",
    response_model=Envelope[ApiKeyOut],
    status_code=status.HTTP_201_CREATED,
)
async def create_key(
    payload: ApiKeyCreate,
    user: CurrentUserDep,
    service: KeyServiceDep,
) -> Envelope[ApiKeyOut]:
    created = await service.create(user_id=user.id, payload=payload)
    return Envelope(data=created)


@router.get("", response_model=Envelope[list[ApiKeyOut]])
async def list_keys(
    user: CurrentUserDep,
    service: KeyServiceDep,
) -> Envelope[list[ApiKeyOut]]:
    items = await service.list(user_id=user.id)
    return Envelope(data=items)


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(
    key_id: UUID,
    user: CurrentUserDep,
    service: KeyServiceDep,
) -> None:
    await service.delete(user_id=user.id, key_id=key_id)


@router.post("/{key_id}/validate", response_model=Envelope[dict[str, bool]])
async def validate_key(
    key_id: UUID,
    user: CurrentUserDep,
    service: KeyServiceDep,
) -> Envelope[dict[str, bool]]:
    ok = await service.validate(user_id=user.id, key_id=key_id)
    return Envelope(data={"valid": ok})
