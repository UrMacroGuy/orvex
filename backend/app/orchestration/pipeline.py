from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Optional
from uuid import UUID

from app.providers.registry import ProviderRegistry
from app.providers.registry import registry as default_registry
from app.schemas.query import ModelResponseStatus, ModelSelection, QueryOptions

from .executor import ParallelExecutor
from .normalizer import NormalizedResponse, ResponseNormalizer
from .router import KeyResolver, QueryRouter

log = logging.getLogger(__name__)


@dataclass(slots=True)
class PipelineResult:
    responses: list[NormalizedResponse]


class OrchestrationPipeline:
    def __init__(
        self,
        *,
        key_resolver: KeyResolver,
        registry: Optional[ProviderRegistry] = None,
        attempts: int = 2,
        timeout_s: float = 60.0,
    ) -> None:
        reg = registry or default_registry
        self._router = QueryRouter(reg, key_resolver, timeout_s=timeout_s)
        self._executor = ParallelExecutor(reg, attempts=attempts)
        self._normalizer = ResponseNormalizer()

    async def run(
        self,
        *,
        user_id: UUID,
        prompt: str,
        selected_models: Iterable[ModelSelection],
        options: QueryOptions,
    ) -> PipelineResult:
        calls = await self._router.route(
            user_id=user_id,
            prompt=prompt,
            selected=selected_models,
            options=options,
        )
        log.info(
            "pipeline_routed",
            extra={"user_id": str(user_id), "calls": len(calls)},
        )
        results = await self._executor.run(calls)
        normalized = self._normalizer.normalize_many(results)
        ok = sum(1 for n in normalized if n.status == ModelResponseStatus.OK)
        log.info(
            "pipeline_done",
            extra={
                "user_id": str(user_id),
                "ok": ok,
                "total": len(normalized),
            },
        )
        return PipelineResult(responses=normalized)
