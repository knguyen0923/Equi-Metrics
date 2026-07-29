"""Shared pytest fixtures for the whole backend test suite.

Import order matters here: the env vars must be set *before* anything
imports app.config (which reads them into a pydantic Settings object at
module import time), so this file sets sensible test defaults first and
only imports app code afterward.
"""

import os

# setdefault (not direct assignment) so a real backend/.env — already
# loaded by the time pytest starts, since pydantic-settings reads it — is
# never overridden; these are just fallbacks for environments (CI, a fresh
# clone) that don't have one.
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-production")

import pytest
from fastapi.testclient import TestClient

from tests.fakes import FakeCollection


@pytest.fixture
def fake_db(monkeypatch):
    """Replaces the real Mongo collections with in-memory fakes, so tests
    never touch a real database.

    app.security and app.routers.* never bind their own name for these —
    they reach the collections only through app.db.get_users_collection() /
    get_simulations_collection() (via FastAPI's Depends), and both of those
    just return app.db's module-level globals. So patching those two
    globals here is the single source of truth for every consumer.
    """
    fake_users = FakeCollection()
    fake_simulations = FakeCollection()

    monkeypatch.setattr("app.db.users_collection", fake_users)
    monkeypatch.setattr("app.db.simulations_collection", fake_simulations)

    return {"users": fake_users, "simulations": fake_simulations}


@pytest.fixture(autouse=True)
def no_real_emails(monkeypatch):
    """Forces the "no API key configured" branch in app/email.py (logs the
    reset link instead of calling Resend), regardless of whether a real
    RESEND_API_KEY is sitting in backend/.env — tests must never make a
    real outbound email API call.
    """
    monkeypatch.setattr("app.config.settings.resend_api_key", "")


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """slowapi's Limiter is a single module-level object shared by every
    request in the process (see app/rate_limit.py) — without resetting it,
    a handful of tests hitting the same rate-limited endpoint (e.g.
    /auth/login, 10/minute) would start failing each other with 429s
    depending on test order.
    """
    from app.rate_limit import limiter

    limiter.reset()
    yield


@pytest.fixture
def client(fake_db):
    """A TestClient wired up to the real app, but with a fake database.

    Uses the app as a context manager so FastAPI's lifespan (which calls
    init_indexes() — a no-op against the fakes, see FakeCollection) runs
    the same way it would in production.
    """
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
