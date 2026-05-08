from __future__ import annotations

from datetime import datetime
from typing import Generic, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .errors import ErrorBody

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TimestampedModel(ORMModel):
    created_at: datetime
    updated_at: Optional[datetime] = None


class IdentifiedModel(TimestampedModel):
    id: UUID


class Meta(BaseModel):
    request_id: Optional[str] = None
    next_cursor: Optional[str] = None


class Envelope(BaseModel, Generic[T]):
    data: Optional[T] = None
    meta: Meta = Field(default_factory=Meta)
    error: Optional[ErrorBody] = None


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: Optional[str] = None
