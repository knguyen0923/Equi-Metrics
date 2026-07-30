# Pydantic request/response schemas for everything under /auth. These
# describe the API's JSON contract — they're separate from the raw dict
# shape stored in MongoDB (see users_collection in db.py).
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.security import MAX_PASSWORD_LENGTH


class UserCreate(BaseModel):
    # EmailStr validates the address format (requires the `email-validator`
    # package). min/max_length keep passwords bcrypt-safe (see security.py).
    email: EmailStr
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class UserOut(BaseModel):
    # What the API ever returns about a user — notably no password_hash,
    # and no stripe_customer_id/stripe_subscription_id (internal
    # correlation keys the frontend has no use for).
    id: str
    email: str
    created_at: datetime
    tier: str = "free"
    subscription_status: Optional[str] = None
    current_period_end: Optional[datetime] = None


class TokenOut(BaseModel):
    # Returned by both /auth/signup and /auth/login.
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    # `token` is the raw value from the emailed reset link (see
    # security.generate_reset_token / hash_reset_token).
    token: str
    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)
