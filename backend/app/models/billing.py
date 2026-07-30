# Pydantic request/response schemas for everything under /billing.
from typing import Optional

from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    # Optional: with only one paid tier, the backend falls back to
    # settings.stripe_default_price_id. Once multiple tiers exist, callers
    # pass the specific price_id for the tier the user picked.
    price_id: Optional[str] = None


class CheckoutSessionResponse(BaseModel):
    checkout_url: str


class PortalSessionResponse(BaseModel):
    portal_url: str
