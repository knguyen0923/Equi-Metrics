"""HTTP-level tests for every /billing/* endpoint (app/routers/billing.py).

Every Stripe SDK call is monkeypatched — these tests never touch the real
Stripe API. `stripe_secret_key`/`stripe_webhook_secret` are set to
plausible-looking values for the duration of each test via the
`stripe_configured` fixture, since app.config.settings is a module-level
singleton read at both import time (module-level `stripe.api_key = ...`)
and request time.
"""

import types

import pytest
import stripe

from tests.test_auth import signup


@pytest.fixture(autouse=True)
def stripe_configured(monkeypatch):
    monkeypatch.setattr("app.config.settings.stripe_secret_key", "sk_test_123")
    monkeypatch.setattr("app.config.settings.stripe_webhook_secret", "whsec_test_123")
    monkeypatch.setattr("app.config.settings.stripe_default_price_id", "price_default")
    monkeypatch.setattr("app.config.settings.frontend_url", "http://localhost:5173")


def _signup_and_get_token(client, email="rider@example.com"):
    return signup(client, email=email).json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _fake_customer(customer_id="cus_123"):
    async def create_async(*args, **kwargs):
        return types.SimpleNamespace(id=customer_id)

    return create_async


def _fake_checkout_session(url="https://checkout.stripe.com/session/abc"):
    async def create_async(*args, **kwargs):
        return types.SimpleNamespace(url=url)

    return create_async


def _fake_portal_session(url="https://billing.stripe.com/portal/abc"):
    async def create_async(*args, **kwargs):
        return types.SimpleNamespace(url=url)

    return create_async


# --- Checkout session -----------------------------------------------------


def test_checkout_session_creates_and_persists_a_stripe_customer_once(client, fake_db, monkeypatch):
    token = _signup_and_get_token(client)
    create_calls = []

    async def create_async(*args, **kwargs):
        create_calls.append(kwargs)
        return types.SimpleNamespace(id="cus_123")

    monkeypatch.setattr(stripe.Customer, "create_async", create_async)
    monkeypatch.setattr(stripe.checkout.Session, "create_async", _fake_checkout_session())

    first = client.post("/billing/checkout-session", json={}, headers=_auth_headers(token))
    assert first.status_code == 200
    assert first.json()["checkout_url"] == "https://checkout.stripe.com/session/abc"
    assert len(create_calls) == 1

    user_doc = next(iter(fake_db["users"].docs.values()))
    assert user_doc["stripe_customer_id"] == "cus_123"

    second = client.post("/billing/checkout-session", json={}, headers=_auth_headers(token))
    assert second.status_code == 200
    # Customer already persisted from the first call — not recreated.
    assert len(create_calls) == 1


def test_checkout_session_requires_authentication(client):
    response = client.post("/billing/checkout-session", json={})
    assert response.status_code == 401


def test_checkout_session_503s_when_stripe_is_not_configured(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.stripe_secret_key", "")
    token = _signup_and_get_token(client)

    response = client.post("/billing/checkout-session", json={}, headers=_auth_headers(token))

    assert response.status_code == 503


def test_checkout_session_rejects_a_user_who_already_has_an_active_subscription(client, fake_db, monkeypatch):
    # Otherwise a double-click on "Upgrade" (or hitting the endpoint twice)
    # creates a second, separate subscription on the same Stripe customer —
    # this is what actually happened during manual testing.
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["tier"] = "paid"
    user_doc["subscription_status"] = "active"

    response = client.post("/billing/checkout-session", json={}, headers=_auth_headers(token))

    assert response.status_code == 400


def test_checkout_session_503s_when_no_price_is_configured(client, monkeypatch):
    monkeypatch.setattr("app.config.settings.stripe_default_price_id", "")
    token = _signup_and_get_token(client)

    response = client.post("/billing/checkout-session", json={}, headers=_auth_headers(token))

    assert response.status_code == 503


# --- Portal session ---------------------------------------------------


def test_portal_session_requires_an_existing_stripe_customer(client):
    token = _signup_and_get_token(client)
    response = client.post("/billing/portal-session", headers=_auth_headers(token))
    assert response.status_code == 400


def test_portal_session_succeeds_for_a_user_with_a_stripe_customer(client, fake_db, monkeypatch):
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"

    monkeypatch.setattr(stripe.billing_portal.Session, "create_async", _fake_portal_session())

    response = client.post("/billing/portal-session", headers=_auth_headers(token))

    assert response.status_code == 200
    assert response.json()["portal_url"] == "https://billing.stripe.com/portal/abc"


# --- Webhook ---------------------------------------------------------


def _post_webhook(client, monkeypatch, event, sig_header="t=1,v1=fake"):
    def construct_event(payload, sig, secret):
        return event

    monkeypatch.setattr(stripe.Webhook, "construct_event", construct_event)
    return client.post("/billing/webhook", content=b"{}", headers={"stripe-signature": sig_header})


def test_webhook_rejects_an_invalid_signature(client, monkeypatch):
    def construct_event(payload, sig, secret):
        raise stripe.SignatureVerificationError("bad signature", sig)

    monkeypatch.setattr(stripe.Webhook, "construct_event", construct_event)

    response = client.post("/billing/webhook", content=b"{}", headers={"stripe-signature": "bad"})

    assert response.status_code == 400


def test_webhook_for_unknown_customer_is_a_harmless_noop(client, monkeypatch):
    event = {
        "type": "customer.subscription.updated",
        "data": {"object": {"customer": "cus_does_not_exist", "status": "active", "id": "sub_1"}},
    }

    response = _post_webhook(client, monkeypatch, event)

    assert response.status_code == 200


def test_webhook_checkout_completed_sets_subscription_id(client, fake_db, monkeypatch):
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"

    event = {
        "type": "checkout.session.completed",
        "data": {"object": {"customer": "cus_123", "subscription": "sub_123"}},
    }

    response = _post_webhook(client, monkeypatch, event)

    assert response.status_code == 200
    assert fake_db["users"].docs[user_doc["_id"]]["stripe_subscription_id"] == "sub_123"


def test_webhook_subscription_updated_sets_tier_paid_and_period_end(client, fake_db, monkeypatch):
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"

    event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "customer": "cus_123",
                "status": "active",
                "id": "sub_123",
                # current_period_end lives on the subscription item, not
                # the subscription itself, as of Stripe's current API
                # version — matches the real webhook payload shape.
                "items": {"data": [{"current_period_end": 1893456000}]},  # 2030-01-01T00:00:00Z
            }
        },
    }

    response = _post_webhook(client, monkeypatch, event)

    assert response.status_code == 200
    updated = fake_db["users"].docs[user_doc["_id"]]
    assert updated["tier"] == "paid"
    assert updated["subscription_status"] == "active"
    assert updated["stripe_subscription_id"] == "sub_123"
    assert updated["current_period_end"] is not None


def test_webhook_subscription_updated_with_past_due_status_does_not_grant_paid_tier(client, fake_db, monkeypatch):
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"

    event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "customer": "cus_123",
                "status": "past_due",
                "id": "sub_123",
                "items": {"data": [{"current_period_end": None}]},
            }
        },
    }

    response = _post_webhook(client, monkeypatch, event)

    assert response.status_code == 200
    assert fake_db["users"].docs[user_doc["_id"]]["tier"] == "free"


def test_webhook_subscription_updated_ignores_a_non_current_subscription(client, fake_db, monkeypatch):
    # A stale/duplicate subscription on the same customer changing status
    # (e.g. its own cancellation working through past_due) must not affect
    # the tier the user actually has via their current subscription.
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"
    user_doc["stripe_subscription_id"] = "sub_current"
    user_doc["tier"] = "paid"
    user_doc["subscription_status"] = "active"

    event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "customer": "cus_123",
                "status": "past_due",
                "id": "sub_stale_duplicate",
                "items": {"data": [{"current_period_end": None}]},
            }
        },
    }

    response = _post_webhook(client, monkeypatch, event)

    assert response.status_code == 200
    updated = fake_db["users"].docs[user_doc["_id"]]
    assert updated["tier"] == "paid"
    assert updated["subscription_status"] == "active"
    assert updated["stripe_subscription_id"] == "sub_current"


def test_webhook_subscription_deleted_resets_tier_to_free(client, fake_db, monkeypatch):
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"
    user_doc["stripe_subscription_id"] = "sub_123"
    user_doc["tier"] = "paid"
    user_doc["subscription_status"] = "active"

    event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_123", "id": "sub_123"}},
    }

    response = _post_webhook(client, monkeypatch, event)

    assert response.status_code == 200
    updated = fake_db["users"].docs[user_doc["_id"]]
    assert updated["tier"] == "free"
    assert updated["subscription_status"] == "canceled"
    assert updated["current_period_end"] is None
    # Cleared, not left pointing at the now-deleted subscription — otherwise
    # a future resubscribe's events would be mistaken for a stale duplicate
    # by _owns_subscription and get ignored.
    assert updated["stripe_subscription_id"] is None


def test_webhook_handles_a_resubscribe_after_a_prior_cancellation(client, fake_db, monkeypatch):
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"
    user_doc["stripe_subscription_id"] = "sub_old"
    user_doc["tier"] = "paid"
    user_doc["subscription_status"] = "active"

    deleted_event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_123", "id": "sub_old"}},
    }
    assert _post_webhook(client, monkeypatch, deleted_event).status_code == 200
    assert fake_db["users"].docs[user_doc["_id"]]["stripe_subscription_id"] is None

    # A brand new subscription (different id) must be accepted, not ignored
    # as a "non-current" one — the prior deletion cleared the slate.
    created_event = {
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "customer": "cus_123",
                "status": "active",
                "id": "sub_new",
                "items": {"data": [{"current_period_end": None}]},
            }
        },
    }
    response = _post_webhook(client, monkeypatch, created_event)

    assert response.status_code == 200
    updated = fake_db["users"].docs[user_doc["_id"]]
    assert updated["tier"] == "paid"
    assert updated["stripe_subscription_id"] == "sub_new"


def test_webhook_subscription_deleted_ignores_a_non_current_subscription(client, fake_db, monkeypatch):
    # A customer can end up with more than one subscription (e.g. a
    # double-submitted Checkout). Deleting the *other* one must not wipe
    # out the tier granted by the subscription the user is actually on.
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    user_doc["stripe_customer_id"] = "cus_123"
    user_doc["stripe_subscription_id"] = "sub_current"
    user_doc["tier"] = "paid"
    user_doc["subscription_status"] = "active"

    event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_123", "id": "sub_stale_duplicate"}},
    }

    response = _post_webhook(client, monkeypatch, event)

    assert response.status_code == 200
    updated = fake_db["users"].docs[user_doc["_id"]]
    assert updated["tier"] == "paid"
    assert updated["subscription_status"] == "active"


def test_webhook_ignores_unhandled_event_types(client, monkeypatch):
    event = {"type": "payment_intent.succeeded", "data": {"object": {}}}
    response = _post_webhook(client, monkeypatch, event)
    assert response.status_code == 200


# --- /auth/me tier defaulting ------------------------------------------


def test_auth_me_exposes_tier_defaulting_to_free_for_existing_users_without_the_field(client, fake_db):
    token = _signup_and_get_token(client)
    user_doc = next(iter(fake_db["users"].docs.values()))
    del user_doc["tier"]  # simulate a pre-migration document

    response = client.get("/auth/me", headers=_auth_headers(token))

    assert response.status_code == 200
    assert response.json()["tier"] == "free"
