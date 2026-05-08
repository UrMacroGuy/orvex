from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.providers.errors import (
    ProviderAuthError,
    ProviderError,
    ProviderInvalidRequestError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.schemas.common import Envelope
from app.schemas.errors import ErrorBody, ErrorCode

log = logging.getLogger(__name__)

_PROVIDER_MAP: dict[type[ProviderError], tuple[ErrorCode, int]] = {
    ProviderTimeoutError: (ErrorCode.PROVIDER_TIMEOUT, 504),
    ProviderAuthError: (ErrorCode.PROVIDER_AUTH, 401),
    ProviderRateLimitError: (ErrorCode.RATE_LIMITED, 429),
    ProviderInvalidRequestError: (ErrorCode.PROVIDER_ERROR, 400),
    ProviderUnavailableError: (ErrorCode.PROVIDER_UNAVAILABLE, 502),
}

_HTTP_MAP: dict[int, ErrorCode] = {
    400: ErrorCode.VALIDATION,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    422: ErrorCode.VALIDATION,
    429: ErrorCode.RATE_LIMITED,
}


def _envelope(
    code: ErrorCode,
    message: str,
    *,
    status_code: int,
    details: Optional[dict[str, Any]] = None,
) -> JSONResponse:
    body = Envelope(error=ErrorBody(code=code, message=message, details=details))
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json", exclude_none=True),
    )


async def _http_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)
    code = _HTTP_MAP.get(exc.status_code, ErrorCode.INTERNAL)
    msg = str(exc.detail) if exc.detail else "request failed"
    return _envelope(code, msg, status_code=exc.status_code)


async def _validation_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    return _envelope(
        ErrorCode.VALIDATION,
        "request validation failed",
        status_code=422,
        details={"errors": exc.errors()},
    )


async def _provider_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ProviderError)
    code, status = _PROVIDER_MAP.get(type(exc), (ErrorCode.PROVIDER_ERROR, 502))
    log.warning(
        "provider_error_handled",
        extra={"code": code.value, "status": exc.status, "msg": exc.message},
    )
    return _envelope(code, exc.message, status_code=status)


async def _generic_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled_exception", extra={"path": request.url.path})
    return _envelope(
        ErrorCode.INTERNAL,
        "internal server error",
        status_code=500,
    )


def install_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, _http_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(ProviderError, _provider_handler)
    app.add_exception_handler(Exception, _generic_handler)
