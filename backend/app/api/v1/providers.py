from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ProviderServiceDep
from app.schemas.common import Envelope
from app.schemas.provider import ProviderInfo

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("", response_model=Envelope[list[ProviderInfo]])
async def list_providers(service: ProviderServiceDep) -> Envelope[list[ProviderInfo]]:
    items = await service.list()
    return Envelope(data=items)
