from __future__ import annotations

import logging
from typing import Optional

from authlib.integrations.httpx_client import AsyncOAuth2Client

from .config import get_settings

log = logging.getLogger(__name__)


class OAuthConfig:
    _google_client: Optional[AsyncOAuth2Client] = None
    _github_client: Optional[AsyncOAuth2Client] = None

    @classmethod
    def get_google_client(cls) -> AsyncOAuth2Client:
        if cls._google_client is None:
            settings = get_settings()
            if not settings.oauth_google_client_id or not settings.oauth_google_client_secret:
                raise ValueError("Google OAuth credentials not configured")

            cls._google_client = AsyncOAuth2Client(
                client_id=settings.oauth_google_client_id,
                client_secret=settings.oauth_google_client_secret,
            )
        return cls._google_client

    @classmethod
    def get_github_client(cls) -> AsyncOAuth2Client:
        if cls._github_client is None:
            settings = get_settings()
            if not settings.oauth_github_client_id or not settings.oauth_github_client_secret:
                raise ValueError("GitHub OAuth credentials not configured")

            cls._github_client = AsyncOAuth2Client(
                client_id=settings.oauth_github_client_id,
                client_secret=settings.oauth_github_client_secret,
            )
        return cls._github_client

    @staticmethod
    def get_google_authorize_url(state: str) -> str:
        settings = get_settings()
        return (
            "https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={settings.oauth_google_client_id}&"
            f"redirect_uri={settings.oauth_redirect_uri}&"
            f"response_type=code&"
            f"scope=openid%20email%20profile&"
            f"state={state}"
        )

    @staticmethod
    def get_github_authorize_url(state: str) -> str:
        settings = get_settings()
        return (
            "https://github.com/login/oauth/authorize?"
            f"client_id={settings.oauth_github_client_id}&"
            f"redirect_uri={settings.oauth_redirect_uri}&"
            f"scope=user:email&"
            f"state={state}"
        )
