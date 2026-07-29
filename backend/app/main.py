# FastAPI app entrypoint. Run locally with:
#   uvicorn app.main:app --reload
# In production (Render), the start command is:
#   uvicorn app.main:app --host 0.0.0.0 --port $PORT
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

import app.logging_config  # noqa: F401 — side effect: configures logging before anything below can log
from app.config import settings
from app.db import init_indexes
from app.rate_limit import limiter
from app.routers import auth, simulations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the app starts (not per-request). The Mongo client
    # itself was already created at import time in db.py; this just makes
    # sure the indexes it depends on exist.
    await init_indexes()
    yield


app = FastAPI(title="Equi-Metrics API", lifespan=lifespan)

# Wires up the shared rate limiter (see rate_limit.py) so the
# @limiter.limit(...) decorators used in the auth/simulations routers
# actually take effect, and requests over the limit get a proper 429
# response instead of an unhandled exception.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    # Bad user input caught deep in a service layer (e.g. an unknown
    # race_key or an invalid custom-race horse selection — see
    # app/ml/registry.py) raises a plain ValueError; this is the one place
    # that turns any of them into a 400, so routers don't each need their
    # own try/except to avoid a raw 500.
    return JSONResponse(status_code=400, content={"detail": str(exc)})

app.add_middleware(
    CORSMiddleware,
    # JWT auth lives in the Authorization header, not cookies, so credentials
    # don't need to cross origins and this list can stay a plain allowlist.
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    # Optional: also allow origins matching a regex (e.g. Vercel preview
    # deployments, which get a unique URL per branch/PR that can't be
    # listed above) — see config.py's frontend_preview_origin_regex.
    allow_origin_regex=settings.frontend_preview_origin_regex or None,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Baseline security headers on every response. CSP is scoped to allow
# cdn.jsdelivr.net specifically (not a blanket allowance) because FastAPI's
# built-in interactive docs (/docs, /redoc) load Swagger UI/ReDoc's JS/CSS
# from there — a stricter default-src-only policy would silently break
# those pages instead of protecting anything, since this API has no other
# first-party HTML/script of its own to worry about.
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # No-op over plain HTTP (local dev) — only takes effect once a browser
    # has seen it over a real HTTPS connection (Render terminates TLS).
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "img-src 'self' data: https://cdn.jsdelivr.net; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "connect-src 'self'"
    ),
}


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    return response


app.include_router(auth.router)
app.include_router(simulations.router)


@app.get("/health")
async def health():
    # Deliberately does not touch Mongo, so a slow/unreachable Atlas cluster
    # can't cause Render's health check to flap the service.
    return {"status": "ok"}
