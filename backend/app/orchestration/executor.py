from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional

from app.providers import ProviderResponse
from app.providers.errors import (
    ProviderError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.providers.registry import ProviderRegistry
from app.utils.retry import with_retries

from .router import RoutedCall

log = logging.getLogger(__name__)

_RETRYABLE: tuple[type[BaseException], ...] = (
    ProviderTimeoutError,
    ProviderRateLimitError,
    ProviderUnavailableError,
)


@dataclass(slots=True)
class ExecutionResult:
    provider_id: str
    model_id: str
    response: Optional[ProviderResponse] = None
    error: Optional[ProviderError] = None
    latency_ms: int = 0


class ParallelExecutor:
    def __init__(
        self,
        registry: ProviderRegistry,
        *,
        attempts: int = 2,
        retry_base_delay: float = 0.5,
    ) -> None:
        self._registry = registry
        self._attempts = attempts
        self._retry_base_delay = retry_base_delay

    async def run(self, calls: list[RoutedCall]) -> list[ExecutionResult]:
        if not calls:
            return []
        return await asyncio.gather(*(self._one(c) for c in calls))

    async def _one(self, call: RoutedCall) -> ExecutionResult:
        provider = self._registry.get(call.provider_id)
        started = time.perf_counter()
        try:
            response = await with_retries(
                lambda: provider.generate(call.request),
                attempts=self._attempts,
                base_delay=self._retry_base_delay,
                retry_on=_RETRYABLE,
            )
            latency = int((time.perf_counter() - started) * 1000)
            log.info(
                "provider_ok",
                extra={
                    "provider": call.provider_id,
                    "model": call.model_id,
                    "latency_ms": latency,
                },
            )
            return ExecutionResult(
                provider_id=call.provider_id,
                model_id=call.model_id,
                response=response,
                latency_ms=latency,
            )
        except ProviderError as e:
            latency = int((time.perf_counter() - started) * 1000)
            log.warning(
                "provider_failed",
                extra={
                    "provider": call.provider_id,
                    "model": call.model_id,
                    "code": e.code,
                    "status": e.status,
                    "latency_ms": latency,
                    "msg": e.message,
                },
            )
            return ExecutionResult(
                provider_id=call.provider_id,
                model_id=call.model_id,
                error=e,
                latency_ms=latency,
            )
        except Exception as e:  # defensive
            latency = int((time.perf_counter() - started) * 1000)
            log.exception(
                "provider_unexpected_failure",
                extra={
                    "provider": call.provider_id,
                    "model": call.model_id,
                    "latency_ms": latency,
                },
            )
            return ExecutionResult(
                provider_id=call.provider_id,
                model_id=call.model_id,
                error=ProviderError(str(e) or "unknown error"),
                latency_ms=latency,
            )
