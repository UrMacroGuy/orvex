from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class FinishReason(str, Enum):
    STOP = "stop"
    LENGTH = "length"
    CONTENT_FILTER = "content_filter"
    ERROR = "error"
    UNKNOWN = "unknown"


@dataclass(slots=True)
class ProviderCapabilities:
    streaming: bool = True
    json_mode: bool = False
    supports_system_prompt: bool = True
    max_input_tokens: Optional[int] = None
    max_output_tokens: Optional[int] = None


@dataclass(slots=True)
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(slots=True)
class ProviderRequest:
    model_id: str
    prompt: str
    api_key: str
    system: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    timeout_s: float = 60.0
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ProviderResponse:
    text: str
    model_id: str
    latency_ms: int
    usage: TokenUsage = field(default_factory=TokenUsage)
    finish_reason: FinishReason = FinishReason.UNKNOWN
    raw: Optional[dict[str, Any]] = None


@dataclass(slots=True)
class StreamChunk:
    delta: str
    index: int = 0
    done: bool = False
    usage: Optional[TokenUsage] = None
