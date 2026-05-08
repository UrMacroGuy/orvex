from __future__ import annotations

import logging
import secrets
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import RedirectResponse

from app.api.deps import CurrentUserDep, DbSession
from app.core.oauth_config import OAuthConfig
from app.schemas.auth import (
    LoginRequest,
    OAuthAuthorizeResponse,
    OAuthCallbackRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserProfile,
)
from app.schemas.common import Envelope
from app.services.auth_service import AuthService

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_oauth_states: dict[str, str] = {}


@router.post("/register", response_model=Envelope[TokenResponse], status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: DbSession,
) -> Envelope[TokenResponse]:
    service = AuthService(session)
    user, token = await service.register(
        email=payload.email,
        password=payload.password,
        name=payload.name,
    )
    user_profile = UserProfile(
        id=user.id,
        email=user.email,
        name=user.name,
        oauth_provider=user.oauth_provider,
        is_verified=user.is_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
    return Envelope(
        data=TokenResponse(access_token=token, user=user_profile),
        meta={},
    )


@router.post("/login", response_model=Envelope[TokenResponse])
async def login(
    payload: LoginRequest,
    session: DbSession,
) -> Envelope[TokenResponse]:
    service = AuthService(session)
    user, token = await service.login(
        email=payload.email,
        password=payload.password,
    )
    user_profile = UserProfile(
        id=user.id,
        email=user.email,
        name=user.name,
        oauth_provider=user.oauth_provider,
        is_verified=user.is_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
    return Envelope(
        data=TokenResponse(access_token=token, user=user_profile),
        meta={},
    )


@router.post("/refresh", response_model=Envelope[TokenResponse])
async def refresh(
    payload: RefreshRequest,
    user: CurrentUserDep,
    session: DbSession,
) -> Envelope[TokenResponse]:
    from sqlalchemy import select
    from app.models.user import User

    service = AuthService(session)
    token = await service.refresh_token(user_id=user.id)

    stmt = select(User).where(User.id == user.id)
    db_user = (await session.execute(stmt)).scalar_one_or_none()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        )

    user_profile = UserProfile(
        id=db_user.id,
        email=db_user.email,
        name=db_user.name,
        oauth_provider=db_user.oauth_provider,
        is_verified=db_user.is_verified,
        created_at=db_user.created_at,
        updated_at=db_user.updated_at,
    )
    return Envelope(
        data=TokenResponse(access_token=token, user=user_profile),
        meta={},
    )


@router.get("/me", response_model=Envelope[UserProfile])
async def get_profile(
    user: CurrentUserDep,
    session: DbSession,
) -> Envelope[UserProfile]:
    from sqlalchemy import select
    from app.models.user import User

    stmt = select(User).where(User.id == user.id)
    db_user = (await session.execute(stmt)).scalar_one_or_none()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        )

    user_profile = UserProfile(
        id=db_user.id,
        email=db_user.email,
        name=db_user.name,
        oauth_provider=db_user.oauth_provider,
        is_verified=db_user.is_verified,
        created_at=db_user.created_at,
        updated_at=db_user.updated_at,
    )
    return Envelope(data=user_profile, meta={})


@router.get("/oauth/{provider}/authorize")
async def oauth_authorize(provider: str) -> RedirectResponse:
    if provider not in ["google", "github"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unsupported provider",
        )

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = provider

    if provider == "google":
        url = OAuthConfig.get_google_authorize_url(state)
    else:
        url = OAuthConfig.get_github_authorize_url(state)

    return RedirectResponse(url=url)


@router.post("/oauth/{provider}/callback", response_model=Envelope[TokenResponse])
async def oauth_callback(
    provider: str,
    payload: OAuthCallbackRequest,
    session: DbSession,
) -> Envelope[TokenResponse]:
    if provider not in ["google", "github"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unsupported provider",
        )

    stored_provider = _oauth_states.pop(payload.state, None)
    if not stored_provider or stored_provider != provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid or expired state",
        )

    from app.core.config import get_settings

    settings = get_settings()

    if provider == "google":
        token_url = "https://oauth2.googleapis.com/token"
        userinfo_url = "https://openidconnect.googleapis.com/v1/userinfo"
        client_id = settings.oauth_google_client_id
        client_secret = settings.oauth_google_client_secret
    else:
        token_url = "https://github.com/login/oauth/access_token"
        userinfo_url = "https://api.github.com/user"
        client_id = settings.oauth_github_client_id
        client_secret = settings.oauth_github_client_secret

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{provider} OAuth not configured",
        )

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            token_url,
            data={
                "code": payload.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": settings.oauth_redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )

        if token_response.status_code != 200:
            log.error(
                "oauth_token_error",
                extra={
                    "provider": provider,
                    "status": token_response.status_code,
                    "body": token_response.text,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="failed to exchange code for token",
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if provider == "google":
            userinfo_response = await client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        else:
            userinfo_response = await client.get(
                userinfo_url,
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )

        if userinfo_response.status_code != 200:
            log.error(
                "oauth_userinfo_error",
                extra={
                    "provider": provider,
                    "status": userinfo_response.status_code,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="failed to fetch user info",
            )

        userinfo = userinfo_response.json()

        if provider == "google":
            oauth_id = userinfo.get("sub")
            email = userinfo.get("email")
            name = userinfo.get("name")
        else:
            oauth_id = str(userinfo.get("id"))
            email = userinfo.get("email")
            name = userinfo.get("name")

        if not oauth_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="missing required user info from provider",
            )

        service = AuthService(session)
        user, token = await service.get_or_create_oauth_user(
            provider=provider,
            oauth_id=oauth_id,
            email=email,
            name=name or email,
        )

        user_profile = UserProfile(
            id=user.id,
            email=user.email,
            name=user.name,
            oauth_provider=user.oauth_provider,
            is_verified=user.is_verified,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        return Envelope(
            data=TokenResponse(access_token=token, user=user_profile),
            meta={},
        )
