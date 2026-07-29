# All /auth/* endpoints: signup, login, "who am I", and the three
# password-recovery flows (forgot / reset / change).
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import settings
from app.db import users_collection
from app.email import send_reset_email
from app.models.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenOut,
    UserCreate,
    UserLogin,
    UserOut,
)
from app.rate_limit import limiter
from app.security import (
    create_access_token,
    generate_reset_token,
    get_current_user,
    hash_password,
    hash_reset_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(doc: dict) -> UserOut:
    """Converts a raw Mongo user document into the public UserOut shape."""
    return UserOut(id=str(doc["_id"]), email=doc["email"], created_at=doc["created_at"])


def _token_for(doc: dict) -> TokenOut:
    """Builds the {access_token, user} response shared by signup and login."""
    token = create_access_token(str(doc["_id"]), doc.get("token_version", 0))
    return TokenOut(access_token=token, user=_user_out(doc))


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def signup(payload: UserCreate):
    # Emails are stored lowercased so "A@x.com" and "a@x.com" are the same
    # account — both here and in every other lookup in this file.
    email = payload.email.lower()
    existing = await users_collection.find_one({"email": email})
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with that email already exists")

    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "token_version": 0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await users_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    # Logs the new user in immediately — no separate "confirm your email
    # then log in" step for this v1.
    return _token_for(doc)


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(request: Request, payload: UserLogin):
    email = payload.email.lower()
    user = await users_collection.find_one({"email": email})
    if user is None or not verify_password(payload.password, user["password_hash"]):
        # Same error whether the email doesn't exist or the password is
        # wrong — avoids confirming to an attacker which emails are registered.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return _token_for(user)


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    # Lets the frontend restore a logged-in session on page load: it holds
    # onto the JWT and calls this to fetch the user it belongs to.
    return _user_out(user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest):
    email = payload.email.lower()
    user = await users_collection.find_one({"email": email})
    if user is not None:
        raw_token, token_hash = generate_reset_token()
        await users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "reset_token_hash": token_hash,
                    "reset_token_expires": datetime.now(timezone.utc) + timedelta(hours=1),
                }
            },
        )
        reset_url = f"{settings.frontend_url}/reset-password?token={raw_token}"
        await send_reset_email(email, reset_url)

    # Always return the same response, whether or not the email is registered,
    # so this endpoint can't be used to enumerate accounts.
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(payload: ResetPasswordRequest):
    token_hash = hash_reset_token(payload.token)
    user = await users_collection.find_one({"reset_token_hash": token_hash})
    expires = user.get("reset_token_expires") if user else None
    if user is None or expires is None or expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid or has expired")

    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(payload.new_password)},
            # Bumping token_version logs out every device that was using the
            # old password's tokens — important since the password (and thus
            # trust in old sessions) just changed via a possibly-compromised path.
            "$inc": {"token_version": 1},
            # Single-use: the token can't be replayed once consumed.
            "$unset": {"reset_token_hash": "", "reset_token_expires": ""},
        },
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    await users_collection.update_one(
        {"_id": user["_id"]},
        # Same token_version bump as reset-password, for the same reason —
        # this also means the token used to make *this* request stops
        # working right after, so the frontend must re-login or store the
        # new one (it currently just shows a success message).
        {"$set": {"password_hash": hash_password(payload.new_password)}, "$inc": {"token_version": 1}},
    )
