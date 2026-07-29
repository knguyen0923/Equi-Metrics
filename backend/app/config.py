# Centralized app configuration. All values are read from environment
# variables (or a local .env file when developing) so the same code runs
# unchanged on a laptop, Render, or anywhere else — only the env vars differ.
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


# Instantiated once at import time. Pydantic validates all required fields
# (mongodb_uri, jwt_secret) immediately, so a missing env var fails loudly
# at startup instead of surfacing as a confusing error mid-request.
settings = Settings()
