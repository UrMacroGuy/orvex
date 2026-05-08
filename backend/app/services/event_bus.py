from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, Optional
from uuid import UUID

from app.schemas.events import StreamEvent

log = logging.getLogger(__name__)


class EventBus:
    """In-memory pub/sub for SSE event streams. One queue per query_id.

    Critical invariant: ``close()`` does **not** pop the queue from ``_queues``.
    Keeping the queue alive lets late subscribers (frontend connecting after the
    pipeline already finished) drain all buffered events before hitting the
    ``None`` sentinel.  The subscribing coroutine owns the final cleanup.
    """

    def __init__(self) -> None:
        self._queues: dict[UUID, asyncio.Queue[Optional[StreamEvent]]] = {}
        self._closed: set[UUID] = set()

    def _get_or_create(self, query_id: UUID) -> asyncio.Queue[Optional[StreamEvent]]:
        q = self._queues.get(query_id)
        if q is None:
            q = asyncio.Queue()
            self._queues[query_id] = q
        return q

    async def publish(self, query_id: UUID, event: StreamEvent) -> None:
        await self._get_or_create(query_id).put(event)

    async def close(self, query_id: UUID) -> None:
        """Signal end-of-stream.  Queue stays in ``_queues`` for late subscribers."""
        self._closed.add(query_id)
        q = self._queues.get(query_id)
        if q is not None:
            await q.put(None)  # None is the sentinel

    async def subscribe(self, query_id: UUID) -> AsyncIterator[StreamEvent]:
        """Yield all events for *query_id* until the stream closes.

        Safe to call after ``close()`` — will drain buffered events then return.
        If the query never existed (or was already cleaned up), returns immediately.
        """
        # Already closed and queue was never created → nothing to stream
        if query_id in self._closed and query_id not in self._queues:
            return

        q = self._get_or_create(query_id)
        try:
            while True:
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=120.0)
                except asyncio.TimeoutError:
                    log.warning("stream_subscribe_timeout", extra={"query_id": str(query_id)})
                    return
                if ev is None:
                    return
                yield ev
        finally:
            # This subscriber is done — clean up so memory doesn't leak
            self._queues.pop(query_id, None)
            self._closed.discard(query_id)


event_bus = EventBus()
