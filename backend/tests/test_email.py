"""Tests for app/email.py's send_reset_email — the Resend integration.

Fakes httpx.AsyncClient (rather than pulling in a mocking library like
respx) since only one method (post) on one object is ever used — mirrors
this codebase's own FakeCollection approach for the DB (see tests/fakes.py).
Runs the async function directly via asyncio.run rather than adding
pytest-asyncio as a dependency for what both come down to a handful of tests.
"""
import asyncio

import httpx

from app import email


class _FakeResponse:
    def raise_for_status(self):
        pass


class _FakeAsyncClient:
    last_call = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers=None, json=None):
        _FakeAsyncClient.last_call = {"url": url, "headers": headers, "json": json}
        return _FakeResponse()


def test_send_reset_email_sends_the_url_in_both_the_html_and_text_bodies(monkeypatch):
    monkeypatch.setattr(email.settings, "resend_api_key", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    reset_url = "https://example.com/reset-password?token=abc123"

    asyncio.run(email.send_reset_email("rider@example.com", reset_url))

    payload = _FakeAsyncClient.last_call["json"]
    assert payload["to"] == ["rider@example.com"]
    assert reset_url in payload["html"]
    assert reset_url in payload["text"]


def test_send_reset_email_does_not_call_resend_when_no_api_key_is_configured(monkeypatch):
    monkeypatch.setattr(email.settings, "resend_api_key", "")

    def fail_if_called(*args, **kwargs):
        raise AssertionError("httpx.AsyncClient should not be constructed without an API key")

    monkeypatch.setattr(httpx, "AsyncClient", fail_if_called)

    # Only assertion that matters: it doesn't raise or try to make a real
    # network call — the "log instead" behavior itself isn't re-asserted
    # here (that's a plain logger.info() call, not worth mocking logging for).
    asyncio.run(email.send_reset_email("rider@example.com", "https://example.com/reset"))
