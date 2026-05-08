from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .common import IdentifiedModel


class ProviderId(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"


class ProviderCapabilities(BaseModel):
    streaming: bool = True
    json_mode: bool = False
    supports_system_prompt: bool = True
    max_input_tokens: Optional[int] = None
    max_output_tokens: Optional[int] = None


class ProviderModelInfo(BaseModel):
    model_id: str
    display_name: str
    capabilities: ProviderCapabilities


class ProviderInfo(BaseModel):
    provider_id: ProviderId
    display_name: str
    models: list[ProviderModelInfo] = Field(default_factory=list)
    requires_byok: bool = True


class ApiKeyCreate(BaseModel):
    provider_id: ProviderId
    key: str = Field(min_length=8, max_length=512)
    label: str = Field(min_length=1, max_length=64)


class ApiKeyOut(IdentifiedModel):
    provider_id: ProviderId
    label: str
    masked: str
    last_validated: Optional[datetime] = None
