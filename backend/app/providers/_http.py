from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Optional

import httpx

from .errors import (
    ProviderAuthError,
    ProviderError,
    ProviderInvalidRequestError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)


def map_status(status: int, body: Optional[dict[str, Any]], *, message: str) -> ProviderError:
    if status in (401, 403):
        return ProviderAuthError(message, status=status, raw=body)
    if status == 429:
        return ProviderRateLimitError(message, status=status, raw=body)
    if 400 <= status < 500:
        return ProviderInvalidRequestError(message, status=status, raw=body)
    return ProviderUnavailableError(message, status=status, raw=body)


def parse_error_body(raw: bytes) -> tuple[Optional[dict[str, Any]], str]:
    try:
        body = json.loads(raw or b"{}")
    except Exception:
        return None, raw.decode("utf-8", "replace")[:500] if raw else "unknown error"
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict):
            return body, str(err.get("message") or err.get("type") or body)
        if isinstance(err, str):
            return body, err
        return body, str(body.get("message") or body)
    return None, str(body)


async def post_json(
    url: str,
    *,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout_s: float,
    provider: str,
) -> dict[str, Any]:
    try:
        async with asyncio.timeout(timeout_s):
            async with httpx.AsyncClient() as client:
                r = await client.post(url, headers=headers, json=payload)
                if r.status_code >= 400:
                    body, msg = parse_error_body(r.content)
                    raise map_status(r.status_code, body, message=f"{provider}: {msg}")
                return r.json()
    except TimeoutError as e:
        raise ProviderTimeoutError(f"{provider} timed out after {timeout_s}s") from e
    except httpx.HTTPError as e:
        raise ProviderUnavailableError(f"{provider} transport error: {e}") from e


async def stream_lines(
    url: str,
    *,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout_s: float,
    provider: str,
) -> AsyncIterator[str]:
    try:
        async with asyncio.timeout(timeout_s):
            async with httpx.AsyncClient() as client:
                async with client.stream("POST", url, headers=headers, json=payload) as r:
                    if r.status_code >= 400:
                        raw = await r.aread()
                        body, msg = parse_error_body(raw)
                        raise map_status(r.status_code, body, message=f"{provider}: {msg}")
                    async for line in r.aiter_lines():
                        yield line
    except TimeoutError as e:
        raise ProviderTimeoutError(f"{provider} stream timed out after {timeout_s}s") from e
    except httpx.HTTPError as e:
        raise ProviderUnavailableError(f"{provider} transport error: {e}") from e


async def get_json(
    url: str,
    *,
    headers: dict[str, str],
    timeout_s: float,
) -> tuple[int, Optional[dict[str, Any]]]:
    try:
        async with asyncio.timeout(timeout_s):
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers=headers)
                try:
                    body = r.json() if r.content else None
                except Exception:
                    body = None
                return r.status_code, body
    except (TimeoutError, httpx.HTTPError):
        return 0, None
