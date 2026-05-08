from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import get_settings


class SecurityError(Exception):
    pass


class JWTError(SecurityError):
    pass


def _key_bytes(secret: str) -> bytes:
    raw = secret.encode("utf-8")
    if len(raw) >= 32:
        return raw[:32]
    return raw + b"\x00" * (32 - len(raw))


def encrypt_secret(plaintext: str) -> tuple[bytes, bytes]:
    settings = get_settings()
    aes = AESGCM(_key_bytes(settings.secret_key))
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)
    return ct, nonce


def decrypt_secret(ciphertext: bytes, nonce: bytes) -> str:
    settings = get_settings()
    aes = AESGCM(_key_bytes(settings.secret_key))
    pt = aes.decrypt(nonce, ciphertext, associated_data=None)
    return pt.decode("utf-8")


def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}…{key[-4:]}"


def issue_jwt(user_id: UUID, *, ttl_seconds: Optional[int] = None) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    exp_minutes = (ttl_seconds // 60) if ttl_seconds else s.jwt_expires_minutes
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=exp_minutes)).timestamp()),
    }
    if s.jwt_audience:
        payload["aud"] = s.jwt_audience
    return jwt.encode(payload, s.secret_key, algorithm=s.jwt_algorithm)


def verify_jwt(token: str) -> UUID:
    s = get_settings()
    try:
        decoded = jwt.decode(
            token,
            s.secret_key,
            algorithms=[s.jwt_algorithm],
            audience=s.jwt_audience,
            options={"verify_aud": s.jwt_audience is not None},
        )
        sub = decoded.get("sub")
        if not sub:
            raise JWTError("token missing subject")
        return UUID(str(sub))
    except (jwt.PyJWTError, ValueError) as e:
        raise JWTError(str(e)) from e
