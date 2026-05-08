from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class ErrorCode(str, Enum):
    VALIDATION = "VALIDATION"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    PROVIDER_AUTH = "PROVIDER_AUTH"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    INVALID_KEY = "INVALID_KEY"
    INTERNAL = "INTERNAL"


class ErrorBody(BaseModel):
    model_config = ConfigDict(frozen=True)

    code: ErrorCode
    message: str
    details: Optional[dict[str, Any]] = None
