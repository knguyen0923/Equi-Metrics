# What's left

All the code-level work (correctness, security, tests, CI) is done. What's
left is dashboard configuration and deployment steps that only you can do —
nothing here requires writing more code.

## 1. Push this branch

Done — everything through the Stripe membership work and the Real Race
removal is committed and pushed to `origin/main`.

## 2. Deploy the backend (Render)

- [ ] Create the Render web service from `render.yaml` if you haven't already
      (Render → New → Blueprint, point at this repo).
- [ ] Fill in the `sync: false` env vars in Render's dashboard:
  - `MONGODB_URI`
  - `JWT_SECRET` — generate a real one:
    `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`
    (must be ≥32 characters — the app now refuses to start otherwise)
  - `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — optional; leave blank to just
    log reset links instead of emailing them
  - `FRONTEND_URL` — **set this after step 3**, once you know the real
    Vercel URL
  - `FRONTEND_PREVIEW_ORIGIN_REGEX` — optional, only needed if you want
    Vercel preview deployments to be able to call the API too (see
    `backend/.env.example` for the pattern)
  - `STRIPE_SECRET_KEY` / `STRIPE_DEFAULT_PRICE_ID` — from your Stripe
    Dashboard (Developers → API keys; Product catalog → your price). Leave
    both blank to disable billing entirely (`/billing/*` 503s instead of
    erroring) if you're not ready to turn this on yet.
  - `STRIPE_WEBHOOK_SECRET` — **not** the same secret `stripe listen` gave
    you locally. Once the Render URL exists (after this step), go to
    Stripe Dashboard → Developers → Webhooks → Add endpoint, point it at
    `https://<your-render-url>/billing/webhook`, select
    `checkout.session.completed`, `customer.subscription.created`,
    `customer.subscription.updated`, and `customer.subscription.deleted`,
    then copy *that* endpoint's signing secret in here.
  - `STRIPE_CHECKOUT_SUCCESS_URL` / `STRIPE_CHECKOUT_CANCEL_URL` — optional,
    default to `{FRONTEND_URL}/account?checkout=success|cancel` if left blank
- [ ] **MongoDB Atlas → Network Access → allow `0.0.0.0/0`** (or set up
      Render's static-IP add-on and add that specific IP instead). Render's
      outbound IPs aren't static, so without this the backend boots fine but
      every DB-backed route (login, signup, history) silently fails —
      `/health` and `/simulations/horses` will still work, which can make
      this confusing to diagnose if you don't check it first.

## 3. Deploy the frontend (Vercel)

- [ ] **Set the project's Root Directory to `frontend`** in Vercel's
      dashboard settings. Without this, Vercel builds from the repo root,
      finds no `package.json`, and the build fails outright.
- [ ] **Set `VITE_API_URL` in Vercel's Environment Variables UI before the
      first build** — it points at your Render backend's URL (e.g.
      `https://equi-metrics-api.onrender.com`). Vite bakes this in at build
      time, not runtime, so if it's missing on the first build the deployed
      site will silently call `localhost:8000` and every request will fail.
      Changing it later requires a redeploy, not just an env var edit.
- [ ] Deploy, then copy the real Vercel URL back into Render's
      `FRONTEND_URL` (step 2) and redeploy the backend so CORS allows it.

## 4. Verify the live deployment

- [ ] Sign up for a new account on the deployed site
- [ ] Build and run a custom race while logged out (should work, won't save)
      — Real Race mode was removed; Custom Race is the only option now
- [ ] Log in and run one again (should save to History)
- [ ] Open History and click a row to see the per-horse breakdown
- [ ] Try "Forgot password" — if `RESEND_API_KEY` isn't set, check the
      Render logs for the logged reset link instead of an email
- [ ] Hit `/docs` on the backend URL directly to confirm the interactive
      API docs still render correctly under the new CSP
- [ ] If Stripe is configured: on `/account`, click **Upgrade**, complete
      Checkout (use a real card if you set live-mode keys, or Stripe's test
      card `4242 4242 4242 4242` if still in test mode), confirm you land
      back on `/account` showing **Plan: Pro**, then click **Manage
      Subscription** to confirm the Customer Portal opens correctly

## Known, deliberate non-fix

`npm audit` will still show one high-severity advisory for `react-router`
(RSC-mode CSRF bypass). This is intentional: the only available fix
downgrades to a version that reintroduces 14 *other* high-severity
vulnerabilities that are already patched in the current version. The app
doesn't use RSC/server actions at all, so this advisory doesn't apply to
how this app actually uses the library. Re-check this if react-router ships
a real in-place patch later.

## Optional, not blocking anything

- Custom domain for the Vercel deployment
- Error tracking (Sentry or similar) — logging is now structured
  (Python's `logging` module) but nothing ships errors anywhere external
- A GitHub branch protection rule requiring the new CI workflow to pass
  before merging to `main`
- Switch Stripe from test mode to live mode once you're ready to accept
  real payments — new secret key, new price, and a new webhook endpoint
  signing secret (live and test mode are entirely separate in Stripe)
- Decide what a paid ("Pro") tier actually unlocks — right now `tier` is
  tracked and kept in sync via webhooks, but nothing in the app gates any
  feature behind it yet (see `require_tier` in `backend/app/security.py`,
  unused by any route so far)
