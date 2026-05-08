from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field

from .errors import ErrorBody
from .provider import ProviderId
from .query import ModelResponseOut
from .synthesis import SynthesisOut


class EventType(str, Enum):
    QUERY_STARTED = "query_started"
    MODEL_STARTED = "model_started"
    MODEL_DELTA = "model_delta"
    MODEL_COMPLETED = "model_completed"
    MODEL_FAILED = "model_failed"
    SYNTHESIS_STARTED = "synthesis_started"
    SYNTHESIS_READY = "synthesis_ready"
    DONE = "done"
    ERROR = "error"


class _BaseEvent(BaseModel):
    query_id: UUID


class QueryStartedEvent(_BaseEvent):
    type: Literal[EventType.QUERY_STARTED] = EventType.QUERY_STARTED


class ModelStartedEvent(_BaseEvent):
    type: Literal[EventType.MODEL_STARTED] = EventType.MODEL_STARTED
    provider_id: ProviderId
    model_id: str


class ModelDeltaEvent(_BaseEvent):
    type: Literal[EventType.MODEL_DELTA] = EventType.MODEL_DELTA
    provider_id: ProviderId
    model_id: str
    delta: str
    index: int


class ModelCompletedEvent(_BaseEvent):
    type: Literal[EventType.MODEL_COMPLETED] = EventType.MODEL_COMPLETED
    response: ModelResponseOut


class ModelFailedEvent(_BaseEvent):
    type: Literal[EventType.MODEL_FAILED] = EventType.MODEL_FAILED
    provider_id: ProviderId
    model_id: str
    error: ErrorBody


class SynthesisStartedEvent(_BaseEvent):
    type: Literal[EventType.SYNTHESIS_STARTED] = EventType.SYNTHESIS_STARTED


class SynthesisReadyEvent(_BaseEvent):
    type: Literal[EventType.SYNTHESIS_READY] = EventType.SYNTHESIS_READY
    synthesis: SynthesisOut
    financial_synthesis: Optional[Any] = None


class DoneEvent(_BaseEvent):
    type: Literal[EventType.DONE] = EventType.DONE


class ErrorEvent(_BaseEvent):
    type: Literal[EventType.ERROR] = EventType.ERROR
    error: ErrorBody


StreamEvent = Annotated[
    Union[
        QueryStartedEvent,
        ModelStartedEvent,
        ModelDeltaEvent,
        ModelCompletedEvent,
        ModelFailedEvent,
        SynthesisStartedEvent,
        SynthesisReadyEvent,
        DoneEvent,
        ErrorEvent,
    ],
    Field(discriminator="type"),
]
