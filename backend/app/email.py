# Sends the password-reset email via Resend's REST API directly over
# httpx, instead of adding the `resend` SDK as a dependency — it's a single
# POST request, not worth a whole extra package.
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

# Matches the app's own dark/orange branding (see frontend/src/index.css's
# --bg-main/--bg-card/--orange/--text-main/--text-muted). Styles are inline
# throughout, not in a <style> block — most email clients strip or ignore
# external/embedded stylesheets, so inline is the only style that reliably
# survives.
def _reset_email_html(reset_url: str) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="margin:0; padding:0; background-color:#060b12; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#060b12; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px; background-color:#111827; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 16px; text-align:center;">
                <div style="display:inline-block; width:40px; height:40px; line-height:40px; border-radius:10px; background-color:#f05a28; color:#ffffff; font-weight:bold; font-size:16px;">EM</div>
                <h1 style="color:#f4f4f5; font-size:20px; margin:16px 0 0;">Equi-Metrics</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px; color:#f4f4f5; font-size:15px; line-height:1.5;">
                <p style="margin:0;">We received a request to reset your password. This link expires in 1 hour.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; text-align:center;">
                <a href="{reset_url}" style="display:inline-block; background-color:#f05a28; color:#ffffff; text-decoration:none; font-weight:bold; padding:12px 28px; border-radius:8px; font-size:15px;">Reset Password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; color:#9ca3af; font-size:13px; line-height:1.5;">
                <p style="margin:0 0 4px;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="margin:0; word-break:break-all;"><a href="{reset_url}" style="color:#9ca3af;">{reset_url}</a></p>
                <p style="margin:16px 0 0;">If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _reset_email_text(reset_url: str) -> str:
    # Plain-text alternative — some clients render this instead of the HTML
    # version, and it's also what a screen reader falls back to.
    return (
        "Equi-Metrics password reset\n\n"
        "We received a request to reset your password. This link expires in 1 hour.\n\n"
        f"{reset_url}\n\n"
        "If you didn't request this, you can safely ignore this email."
    )


async def send_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.resend_api_key:
        # No API key configured (e.g. local dev) — log instead of failing the request.
        logger.info("RESEND_API_KEY not set; reset link for %s: %s", to_email, reset_url)
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": "Reset your Equi-Metrics password",
                "html": _reset_email_html(reset_url),
                "text": _reset_email_text(reset_url),
            },
        )
        # Raises if Resend rejects the request (bad API key, unverified
        # sending domain, etc.) so the failure surfaces instead of being
        # silently swallowed.
        response.raise_for_status()
