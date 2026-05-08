from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from .common import IdentifiedModel
from .finance import ResearchType, TimeHorizon
from .provider import ProviderId


class QueryStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class ModelResponseStatus(str, Enum):
    OK = "ok"
    TIMEOUT = "timeout"
    ERROR = "error"


class ModelSelection(BaseModel):
    provider_id: ProviderId
    model_id: str = Field(min_length=1, max_length=128)


class QueryOptions(BaseModel):
    web_research: bool = False
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, gt=0, le=32_000)
    system_prompt: Optional[str] = Field(default=None, max_length=8_000)
    # Finance-specific options
    research_type: Optional[ResearchType] = None
    ticker: Optional[str] = Field(default=None, max_length=10)
    company_name: Optional[str] = Field(default=None, max_length=128)
    time_horizon: Optional[TimeHorizon] = None


class QueryCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=20_000)
    selected_models: list[ModelSelection] = Field(min_length=1, max_length=8)
    options: QueryOptions = Field(default_factory=QueryOptions)


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0


class ModelResponseOut(IdentifiedModel):
    query_id: UUID
    provider_id: ProviderId
    model_id: str
    status: ModelResponseStatus
    text: Optional[str] = None
    latency_ms: int
    usage: Optional[TokenUsage] = None
    error: Optional[str] = None


class QueryOut(IdentifiedModel):
    user_id: UUID
    prompt: str
    selected_models: list[ModelSelection]
    options: QueryOptions
    status: QueryStatus
    error: Optional[str] = None
    completed_at: Optional[datetime] = None
