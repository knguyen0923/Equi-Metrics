"""Verifies the *mechanism* app/main.py wires up for optional preview-origin
CORS (Starlette's allow_origin_regex) actually behaves as documented in the
README, using a throwaway app rather than app.main itself — app.main builds
its real CORSMiddleware once at import time from the process-wide `settings`
singleton, so there's no way to exercise a different
frontend_preview_origin_regex value against it without a bigger app-factory
refactor than this one setting warrants.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

# The example pattern from README.md's deployment section — a Vercel
# project named "equi-metrics" gets preview URLs like
# https://equi-metrics-git-my-branch-someuser.vercel.app.
PREVIEW_ORIGIN_REGEX = r"^https://equi-metrics.*\.vercel\.app$"


def _app_with_cors(allow_origin_regex):
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://equi-metrics.com"],
        allow_origin_regex=allow_origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return app


def test_preview_origin_regex_allows_a_vercel_preview_url():
    client = TestClient(_app_with_cors(PREVIEW_ORIGIN_REGEX))
    response = client.get("/ping", headers={"Origin": "https://equi-metrics-git-my-branch-someuser.vercel.app"})
    assert response.headers["access-control-allow-origin"] == "https://equi-metrics-git-my-branch-someuser.vercel.app"


def test_preview_origin_regex_still_rejects_an_unrelated_origin():
    client = TestClient(_app_with_cors(PREVIEW_ORIGIN_REGEX))
    response = client.get("/ping", headers={"Origin": "https://not-us.vercel.app"})
    assert "access-control-allow-origin" not in response.headers


def test_without_a_configured_regex_only_the_exact_allowlisted_origin_works():
    client = TestClient(_app_with_cors(None))
    allowed = client.get("/ping", headers={"Origin": "https://equi-metrics.com"})
    preview = client.get("/ping", headers={"Origin": "https://equi-metrics-git-my-branch-someuser.vercel.app"})

    assert allowed.headers["access-control-allow-origin"] == "https://equi-metrics.com"
    assert "access-control-allow-origin" not in preview.headers
