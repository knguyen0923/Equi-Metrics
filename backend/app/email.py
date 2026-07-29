# Sends the password-reset email via Resend's REST API directly over
# httpx, instead of adding the `resend` SDK as a dependency — it's a single
# POST request, not worth a whole extra package.
import httpx

from app.config import settings

RESEND_API_URL = "https://api.resend.com/emails"


async def send_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.resend_api_key:
        # No API key configured (e.g. local dev) — log instead of failing the request.
        print(f"[email] RESEND_API_KEY not set; reset link for {to_email}: {reset_url}")
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": "Reset your Equi-Metrics password",
                "html": (
                    "<p>Click the link below to reset your password. "
                    "This link expires in 1 hour.</p>"
                    f'<p><a href="{reset_url}">{reset_url}</a></p>'
                ),
            },
        )
        # Raises if Resend rejects the request (bad API key, unverified
        # sending domain, etc.) so the failure surfaces instead of being
        # silently swallowed.
        response.raise_for_status()
