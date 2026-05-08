from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx


class FinancialHTTPClient:
    def __init__(self, api_key: str, timeout: float = 30.0):
        self.api_key = api_key
        self.timeout = httpx.Timeout(timeout)

    async def get(
        self,
        url: str,
        params: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Optional[dict[str, Any]]:
        """Make async GET request."""
        if params is None:
            params = {}
        if headers is None:
            headers = {}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, asyncio.TimeoutError, ValueError):
            return None

    async def post(
        self,
        url: str,
        data: Optional[dict[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Optional[dict[str, Any]]:
        """Make async POST request."""
        if headers is None:
            headers = {}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url, data=data, json=json, headers=headers
                )
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, asyncio.TimeoutError, ValueError):
            return None
