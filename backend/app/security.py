# Password hashing, JWT issuing/verification, and the FastAPI dependencies
# ("get_current_user" / "get_optional_user") that routers use to figure out
# who's calling. Uses `bcrypt` directly (not `passlib`, which is unmaintained
# and breaks on bcrypt>=4.1) and `PyJWT` directly (not `python-jose`, which
# has long-unpatched CVEs in a transitive dependency).
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import get_users_collection

# bcrypt silently ignores/truncates bytes past 72 — capping the password
# length here keeps every character a user types actually meaningful.
MAX_PASSWORD_LENGTH = 64

# auto_error=False means a missing Authorization header doesn't raise by
# itself — it lets get_optional_user() treat "no token" as "anonymous user"
# instead of a hard 401.
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    # bcrypt.gensalt() picks a fresh random salt per call, so two users with
    # the same password get different hashes.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str, token_version: int) -> str:
    # token_version is embedded in the token and re-checked against the
    # user's current value on every request (see _load_user_for_token).
    # Bumping it in the database (on password change/reset) instantly
    # invalidates every previously issued token for that user, without
    # needing a separate token-blacklist collection.
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "token_version": token_version, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    try:
        # algorithms=["HS256"] is pinned explicitly rather than trusting the
        # token's own header — accepting whatever algorithm the token claims
        # to use is a classic JWT vulnerability (algorithm confusion).
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def hash_reset_token(raw_token: str) -> str:
    # The raw token goes out in the reset-password email link; only its
    # hash is ever stored, so a leaked database can't be used to forge
    # working reset links.
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_reset_token() -> tuple[str, str]:
    """Returns (raw_token_for_email_link, sha256_hash_for_storage)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_reset_token(raw)


async def _load_user_for_token(payload: dict, users_collection) -> Optional[dict]:
    """Looks up the user a decoded JWT claims to belong to, and rejects it
    if the account's token_version has since moved on (password changed,
    reset used, etc.) — this is what makes token_version bumps actually
    invalidate old tokens instead of just being inert data.
    """
    user = await users_collection.find_one({"_id": ObjectId(payload["sub"])})
    if user is None or user.get("token_version", 0) != payload.get("token_version"):
        return None
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    users_collection=Depends(get_users_collection),
) -> dict:
    """FastAPI dependency for endpoints that require a logged-in user
    (history, change-password, /auth/me). Raises 401 if there's no token,
    the token is invalid/expired, or it's been superseded by a password
    change.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    user = await _load_user_for_token(payload, users_collection)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    users_collection=Depends(get_users_collection),
) -> Optional[dict]:
    """Same idea as get_current_user, but for endpoints usable both logged
    in and anonymously (/simulations/run) — returns None instead of raising
    when there's no valid session, so the caller can branch on it.
    """
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except HTTPException:
        return None
    return await _load_user_for_token(payload, users_collection)
