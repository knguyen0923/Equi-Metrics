# All /billing/* endpoints: starting a Stripe Checkout session, opening the
# Stripe Customer Portal, and receiving Stripe's webhook events. Checkout and
# the Portal are both Stripe-hosted pages — this router only ever creates a
# session and hands back its URL; the frontend just redirects the browser
# there. That keeps card data, PCI scope, invoices, and cancellation flows
# entirely on Stripe's side.
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import settings
from app.db import get_users_collection
from app.models.billing import CheckoutSessionResponse, CheckoutSessionRequest, PortalSessionResponse
from app.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

stripe.api_key = settings.stripe_secret_key

# Webhook event types that move a subscription forward or end it. Anything
# else (invoice emails, payment-method updates, etc.) is acknowledged with
# a 200 but otherwise ignored — Stripe retries on non-2xx, so an unhandled
# event type must not look like a failure.
_SUBSCRIPTION_ACTIVE_STATUSES = {"active", "trialing"}


def _require_stripe_configured() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this server",
        )


def _owns_subscription(user: dict, subscription_id: str) -> bool:
    """Whether `subscription_id` is the one this user is actually tracked
    as being on — true if it matches, or if the user has no subscription
    tracked yet (first-ever subscription, or a clean slate after a prior
    one was fully deleted). False for some other/stale subscription on the
    same Stripe customer, which webhook handlers must not act on.
    """
    current = user.get("stripe_subscription_id")
    return current is None or current == subscription_id


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    user: dict = Depends(get_current_user),
    users_collection=Depends(get_users_collection),
):
    _require_stripe_configured()
    price_id = payload.price_id or settings.stripe_default_price_id
    if not price_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="No price configured")

    # Without this, a double-click on "Upgrade" (or hitting this endpoint
    # twice before the first Checkout completes) creates a second, separate
    # subscription on the same Stripe customer — which is exactly how this
    # account ended up with two active subscriptions and conflicting
    # webhook events during testing. One subscription per user, enforced
    # here rather than relying on the webhook handlers to sort it out after.
    if user.get("tier") == "paid" and user.get("subscription_status") in _SUBSCRIPTION_ACTIVE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active subscription — manage it instead of starting a new one",
        )

    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        # Created once per user and persisted immediately (before the
        # Checkout Session even exists) so webhook handlers can always find
        # the owning user via a single stripe_customer_id lookup, with no
        # ambiguity about whether Checkout created its own customer record.
        customer = await stripe.Customer.create_async(email=user["email"], metadata={"user_id": str(user["_id"])})
        customer_id = customer.id
        await users_collection.update_one({"_id": user["_id"]}, {"$set": {"stripe_customer_id": customer_id}})

    session = await stripe.checkout.Session.create_async(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=settings.stripe_checkout_success_url or f"{settings.frontend_url}/account?checkout=success",
        cancel_url=settings.stripe_checkout_cancel_url or f"{settings.frontend_url}/account?checkout=cancel",
        client_reference_id=str(user["_id"]),
    )
    return CheckoutSessionResponse(checkout_url=session.url)


@router.post("/portal-session", response_model=PortalSessionResponse)
async def create_portal_session(user: dict = Depends(get_current_user)):
    _require_stripe_configured()
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No billing account yet — subscribe first")

    portal = await stripe.billing_portal.Session.create_async(
        customer=customer_id,
        return_url=f"{settings.frontend_url}/account",
    )
    return PortalSessionResponse(portal_url=portal.url)


async def _apply_subscription_update(subscription: dict, users_collection) -> None:
    customer_id = subscription["customer"]
    user = await users_collection.find_one({"stripe_customer_id": customer_id})
    if user is None:
        logger.warning("Webhook for unknown Stripe customer %s — ignoring", customer_id)
        return

    # Guards against a customer with more than one subscription (see
    # create_checkout_session's check, and _owns_subscription's docstring):
    # only the subscription this user is already tracked as being on (or
    # their first-ever one) gets to drive tier/status here.
    if not _owns_subscription(user, subscription["id"]):
        logger.info(
            "Ignoring update for non-current subscription %s for customer %s", subscription["id"], customer_id
        )
        return

    status_value = subscription["status"]
    # current_period_end lives on the subscription item, not the
    # subscription itself, as of Stripe's 2026-06-24 API version (each item
    # can have its own billing cycle). We only ever create single-item
    # subscriptions, so the first item's period end is the one that matters.
    items = subscription.get("items", {}).get("data", [])
    period_end = items[0].get("current_period_end") if items else None
    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "tier": "paid" if status_value in _SUBSCRIPTION_ACTIVE_STATUSES else "free",
                "subscription_status": status_value,
                "stripe_subscription_id": subscription["id"],
                "current_period_end": (
                    datetime.fromtimestamp(period_end, tz=timezone.utc) if period_end else None
                ),
            }
        },
    )


async def _apply_subscription_deleted(subscription: dict, users_collection) -> None:
    customer_id = subscription["customer"]
    user = await users_collection.find_one({"stripe_customer_id": customer_id})
    if user is None:
        logger.warning("Webhook for unknown Stripe customer %s — ignoring", customer_id)
        return

    # Only demote the user if the *subscription we're actually tracking* is
    # the one being deleted — deleting some other, non-current subscription
    # on the same customer must not wipe out a still-active one. (Unlike
    # _apply_subscription_update, a brand new user has no subscription to
    # delete yet, so there's no "or None" case worth accepting here.)
    if user.get("stripe_subscription_id") != subscription["id"]:
        logger.info(
            "Ignoring deletion of non-current subscription %s for customer %s", subscription["id"], customer_id
        )
        return

    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "tier": "free",
                "subscription_status": "canceled",
                "current_period_end": None,
                # Cleared (not left pointing at the now-deleted subscription)
                # so a future resubscribe's create/update events pass the
                # "no subscription tracked yet" branch of _owns_subscription
                # instead of being mistaken for a stale duplicate.
                "stripe_subscription_id": None,
            }
        },
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, users_collection=Depends(get_users_collection)):
    # Deliberately no @limiter.limit here and no auth dependency: Stripe (not
    # a browser) calls this directly, and the signature check below is what
    # actually secures it — rate-limiting by IP would risk throttling
    # Stripe's own retry bursts instead of adding any real protection.
    #
    # The raw bytes matter: `request` must stay a plain Request (not a
    # Pydantic body model), since FastAPI would otherwise parse and
    # re-serialize the JSON before signature verification ever sees the
    # exact bytes Stripe signed.
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    event_type = event["type"]
    raw_data = event["data"]["object"]
    # .to_dict() turns Stripe's StripeObject into a plain dict: this SDK
    # version's StripeObject supports __getitem__ but not .get(), which the
    # handlers below rely on for optional fields like current_period_end.
    # (Test doubles pass plain dicts directly, which have no .to_dict().)
    data = raw_data.to_dict() if hasattr(raw_data, "to_dict") else raw_data

    if event_type == "checkout.session.completed":
        customer_id = data["customer"]
        user = await users_collection.find_one({"stripe_customer_id": customer_id})
        subscription_id = data.get("subscription")
        if user is not None and subscription_id and _owns_subscription(user, subscription_id):
            await users_collection.update_one(
                {"_id": user["_id"]}, {"$set": {"stripe_subscription_id": subscription_id}}
            )
    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        await _apply_subscription_update(data, users_collection)
    elif event_type == "customer.subscription.deleted":
        await _apply_subscription_deleted(data, users_collection)
    else:
        logger.info("Unhandled Stripe webhook event type: %s", event_type)

    return {"received": True}
