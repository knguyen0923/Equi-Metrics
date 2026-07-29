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
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(simulations.router)


@app.get("/health")
async def health():
    # Deliberately does not touch Mongo, so a slow/unreachable Atlas cluster
    # can't cause Render's health check to flap the service.
    return {"status": "ok"}
