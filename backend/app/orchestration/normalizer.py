from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from app.providers import TokenUsage
from app.schemas.query import ModelResponseStatus

from .executor import ExecutionResult

_WHITESPACE = re.compile(r"[ \t]+")
_LINEBREAKS = re.compile(r"\n{3,}")


@dataclass(slots=True)
class NormalizedResponse:
    provider_id: str
    model_id: str
    status: ModelResponseStatus
    text: Optional[str]
    latency_ms: int
    usage: Optional[TokenUsage]
    error: Optional[str]
    error_code: Optional[str]


class ResponseNormalizer:
    def normalize(self, result: ExecutionResult) -> NormalizedResponse:
        if result.response is not None:
            return NormalizedResponse(
                provider_id=result.provider_id,
                model_id=result.model_id,
                status=ModelResponseStatus.OK,
                text=self._clean(result.response.text),
                latency_ms=result.response.latency_ms,
                usage=result.response.usage,
                error=None,
                error_code=None,
            )
        err = result.error
        is_timeout = err is not None and err.code == "PROVIDER_TIMEOUT"
        return NormalizedResponse(
            provider_id=result.provider_id,
            model_id=result.model_id,
            status=ModelResponseStatus.TIMEOUT if is_timeout else ModelResponseStatus.ERROR,
            text=None,
            latency_ms=result.latency_ms,
            usage=None,
            error=(err.message if err else "unknown error"),
            error_code=(err.code if err else "PROVIDER_ERROR"),
        )

    def normalize_many(self, results: list[ExecutionResult]) -> list[NormalizedResponse]:
        return [self.normalize(r) for r in results]

    @staticmethod
    def _clean(text: str) -> str:
        if not text:
            return ""
        cleaned = _WHITESPACE.sub(" ", text)
        cleaned = _LINEBREAKS.sub("\n\n", cleaned)
        return cleaned.strip()
