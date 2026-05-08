from __future__ import annotations

import logging
import re
from uuid import UUID

import bcrypt
from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import issue_jwt
from app.models.user import User

log = logging.getLogger(__name__)


class AuthError(Exception):
    pass


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def register(
        self, *, email: str, password: str, name: str
    ) -> tuple[User, str]:
        try:
            validate_email(email)
        except EmailNotValidError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"invalid email: {e}",
            )

        existing = await self._fetch_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="email already registered",
            )

        if not self._validate_password(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="password must be at least 8 characters with uppercase, lowercase, and numbers",
            )

        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12))

        user = User(
            email=email,
            password_hash=password_hash,
            name=name,
            is_verified=False,
        )
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)

        token = issue_jwt(user.id)
        log.info("user_registered", extra={"user_id": str(user.id), "email": email})

        return user, token

    async def login(self, *, email: str, password: str) -> tuple[User, str]:
        user = await self._fetch_by_email(email)
        if not user or not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid email or password",
            )

        if not bcrypt.checkpw(password.encode("utf-8"), user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid email or password",
            )

        token = issue_jwt(user.id)
        log.info("user_login", extra={"user_id": str(user.id)})

        return user, token

    async def get_or_create_oauth_user(
        self,
        *,
        provider: str,
        oauth_id: str,
        email: str,
        name: str,
    ) -> tuple[User, str]:
        try:
            validate_email(email)
        except EmailNotValidError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"invalid email from {provider}: {e}",
            )

        stmt = select(User).where(
            User.oauth_provider == provider,
            User.oauth_id == oauth_id,
        )
        user = (await self._db.execute(stmt)).scalar_one_or_none()

        if user:
            log.info(
                "oauth_login_existing",
                extra={"user_id": str(user.id), "provider": provider},
            )
            token = issue_jwt(user.id)
            return user, token

        existing_email = await self._fetch_by_email(email)
        if existing_email:
            existing_email.oauth_provider = provider
            existing_email.oauth_id = oauth_id
            if not existing_email.name:
                existing_email.name = name
            await self._db.commit()
            await self._db.refresh(existing_email)
            log.info(
                "oauth_linked_existing",
                extra={"user_id": str(existing_email.id), "provider": provider},
            )
            token = issue_jwt(existing_email.id)
            return existing_email, token

        user = User(
            email=email,
            name=name,
            oauth_provider=provider,
            oauth_id=oauth_id,
            is_verified=True,
        )
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)

        token = issue_jwt(user.id)
        log.info(
            "oauth_registered",
            extra={"user_id": str(user.id), "provider": provider},
        )

        return user, token

    async def refresh_token(self, *, user_id: UUID) -> str:
        stmt = select(User).where(User.id == user_id)
        user = (await self._db.execute(stmt)).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="user not found",
            )
        return issue_jwt(user.id)

    async def _fetch_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        return (await self._db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    def _validate_password(password: str) -> bool:
        if len(password) < 8:
            return False
        has_upper = re.search(r"[A-Z]", password)
        has_lower = re.search(r"[a-z]", password)
        has_digit = re.search(r"\d", password)
        return bool(has_upper and has_lower and has_digit)
