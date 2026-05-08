from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from .common import IdentifiedModel


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class UserProfile(IdentifiedModel):
    email: str
    name: Optional[str] = None
    oauth_provider: Optional[str] = None
    is_verified: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class OAuthAuthorizeResponse(BaseModel):
    authorization_url: str
