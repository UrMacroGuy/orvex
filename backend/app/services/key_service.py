from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_secret, encrypt_secret, mask_key
from app.models.api_key import ApiKey as ApiKeyModel
from app.providers.errors import ProviderError
from app.providers.registry import registry as provider_registry
from app.schemas.provider import ApiKeyCreate, ApiKeyOut, ProviderId

log = logging.getLogger(__name__)


class KeyService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def create(self, *, user_id: UUID, payload: ApiKeyCreate) -> ApiKeyOut:
        ct, nonce = encrypt_secret(payload.key)
        row = ApiKeyModel(
            id=uuid4(),
            user_id=user_id,
            provider_id=payload.provider_id.value,
            label=payload.label,
            masked=mask_key(payload.key),
            ciphertext=ct,
            nonce=nonce,
        )
        self._db.add(row)
        await self._db.commit()
        await self._db.refresh(row)
        log.info(
            "api_key_created",
            extra={"user_id": str(user_id), "provider": payload.provider_id.value},
        )
        return self._to_out(row)

    async def list(self, *, user_id: UUID) -> list[ApiKeyOut]:
        stmt = (
            select(ApiKeyModel)
            .where(ApiKeyModel.user_id == user_id)
            .order_by(ApiKeyModel.created_at)
        )
        rows = (await self._db.execute(stmt)).scalars().all()
        return [self._to_out(r) for r in rows]

    async def delete(self, *, user_id: UUID, key_id: UUID) -> None:
        stmt = delete(ApiKeyModel).where(
            ApiKeyModel.id == key_id, ApiKeyModel.user_id == user_id
        )
        result = await self._db.execute(stmt)
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="key not found")
        await self._db.commit()

    async def validate(self, *, user_id: UUID, key_id: UUID) -> bool:
        row = await self._fetch(user_id, key_id)
        plaintext = decrypt_secret(row.ciphertext, row.nonce)
        try:
            provider = provider_registry.get(row.provider_id)
        except ProviderError as e:
            raise HTTPException(status_code=400, detail=str(e))
        valid = await provider.validate_key(plaintext)
        if valid:
            row.last_validated = datetime.now(timezone.utc)
            await self._db.commit()
        return valid

    async def resolve_active_key(self, *, user_id: UUID, provider_id: str) -> str:
        stmt = (
            select(ApiKeyModel)
            .where(
                ApiKeyModel.user_id == user_id,
                ApiKeyModel.provider_id == provider_id,
            )
            .order_by(ApiKeyModel.created_at.desc())
            .limit(1)
        )
        row = (await self._db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"no API key configured for provider {provider_id!r}",
            )
        return decrypt_secret(row.ciphertext, row.nonce)

    async def _fetch(self, user_id: UUID, key_id: UUID) -> ApiKeyModel:
        stmt = select(ApiKeyModel).where(
            ApiKeyModel.id == key_id, ApiKeyModel.user_id == user_id
        )
        row = (await self._db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="key not found")
        return row

    @staticmethod
    def _to_out(row: ApiKeyModel) -> ApiKeyOut:
        return ApiKeyOut(
            id=row.id,
            provider_id=ProviderId(row.provider_id),
            label=row.label,
            masked=row.masked,
            last_validated=row.last_validated,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
