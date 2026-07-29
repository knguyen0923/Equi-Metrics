# Centralized app configuration. All values are read from environment
# variables (or a local .env file when developing) so the same code runs
# unchanged on a laptop, Render, or anywhere else — only the env vars differ.
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # env_file=".env" lets `uvicorn` pick up backend/.env locally; in
    # production (Render) the real environment variables are used instead
    # and no .env file needs to exist.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str
    mongodb_db_name: str = "equi_metrics"
    jwt_secret: str
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    resend_api_key: str = ""
    resend_from_email: str = "Equi-Metrics <onboarding@resend.dev>"
    frontend_url: str = "http://localhost:5173"
    # Optional regex matched against the request Origin header, in addition
    # to frontend_url — lets CORS also allow e.g. Vercel's per-branch/PR
    # preview URLs (which don't match any single fixed frontend_url) without
    # opening things up to arbitrary origins. Empty by default: unset means
    # only frontend_url + localhost work, exactly like before. See README
    # for how to set this once you know your Vercel project's URL pattern.
    frontend_preview_origin_regex: str = ""

    @field_validator("jwt_secret")
    @classmethod
    def _jwt_secret_must_be_long_enough(cls, value: str) -> str:
        # A short/guessable secret lets an attacker forge access tokens for
        # any user — fail loudly at startup (like a missing required env
        # var already does) rather than quietly accepting e.g. the
        # .env.example placeholder "changeme". 32 bytes matches PyJWT's own
        # recommended minimum for HS256 (see the InsecureKeyLengthWarning
        # it raises below that).
        if len(value) < 32:
            raise ValueError(f"JWT_SECRET must be at least 32 characters long (got {len(value)})")
        return value


# Instantiated once at import time. Pydantic validates all required fields
# (mongodb_uri, jwt_secret) immediately, so a missing env var fails loudly
# at startup instead of surfacing as a confusing error mid-request.
settings = Settings()
