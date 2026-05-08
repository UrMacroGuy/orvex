from __future__ import annotations

from typing import Any, Optional


class ProviderError(Exception):
    code: str = "PROVIDER_ERROR"

    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        raw: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.raw = raw

    def __repr__(self) -> str:
        return f"{type(self).__name__}(code={self.code!r}, status={self.status!r}, message={self.message!r})"


class ProviderTimeoutError(ProviderError):
    code = "PROVIDER_TIMEOUT"


class ProviderAuthError(ProviderError):
    code = "PROVIDER_AUTH"


class ProviderRateLimitError(ProviderError):
    code = "RATE_LIMITED"


class ProviderInvalidRequestError(ProviderError):
    code = "PROVIDER_INVALID_REQUEST"


class ProviderUnavailableError(ProviderError):
    code = "PROVIDER_UNAVAILABLE"
