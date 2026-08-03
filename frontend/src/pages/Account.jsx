import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

// Minimal account page — change-password plus subscription management.
// Only reachable when logged in; bounces to /login otherwise.
export default function Account() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingSubmitting, setBillingSubmitting] = useState(false);

  // Wait for AuthContext to finish checking the stored token before
  // deciding whether to redirect, so a logged-in user isn't briefly bounced
  // to /login while their session is still being restored on page load.
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBillingClick() {
    setBillingError("");
    setBillingSubmitting(true);
    try {
      const { checkout_url, portal_url } =
        user.tier === "free" ? await api.createCheckoutSession() : await api.createPortalSession();
      window.location.href = checkout_url || portal_url;
    } catch (err) {
      setBillingError(err.message);
      setBillingSubmitting(false);
    }
  }

  const checkoutResult = searchParams.get("checkout");

  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ marginTop: '40px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="section-heading" style={{ textAlign: 'center' }}>
            <h2>Account</h2>
            <p style={{ color: 'var(--text-muted)' }}>{user.email}</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            {checkoutResult === 'success' && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Subscription updated. Thanks!</p>
            )}
            {checkoutResult === 'cancel' && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Checkout canceled.</p>
            )}
            <p style={{ color: 'var(--text-muted)' }}>
              Plan: <strong>{user.tier === 'paid' ? 'Pro' : 'Free'}</strong>
              {user.subscription_status && user.subscription_status !== 'active' && ` (${user.subscription_status})`}
            </p>
            {user.tier === 'paid' && user.current_period_end && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Renews {new Date(user.current_period_end).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
            {billingError && <p style={{ color: 'var(--orange)', fontSize: '0.85rem' }}>{billingError}</p>}
            {/* Upgrading is a real Stripe subscription (sandbox/test mode
                right now), but no route actually gates any feature behind
                tier yet (see require_tier in backend/app/security.py) — this
                says so plainly instead of leaving "Upgrade" to imply
                something it doesn't do yet. */}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {user.tier === 'free'
                ? "Upgrading is a real subscription (test-mode Stripe right now — no real charge). It changes your account to Pro, but doesn't unlock anything extra yet: every account runs the same prediction model today."
                : "Your subscription is real (test-mode Stripe right now — no real charge). It doesn't unlock anything extra yet: every account runs the same prediction model today."}
            </p>
            <div
              style={{
                textAlign: 'left',
                marginTop: '10px',
                marginBottom: '14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
              }}
            >
              <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 700, fontSize: '0.85rem' }}>
                Coming soon to Pro
              </p>
              <p style={{ margin: '4px 0 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                We've already trained and evaluated these models — Pro access to run them is on the roadmap:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <li>Random Forest</li>
                <li>LightGBM Ranker</li>
                <li>CatBoost Ranker</li>
                <li>Neural Network Ranker</li>
              </ul>
            </div>
            <button type="button" onClick={handleBillingClick} disabled={billingSubmitting}>
              {billingSubmitting ? 'Please wait...' : user.tier === 'free' ? 'Upgrade' : 'Manage Subscription'}
            </button>
          </div>

          <form className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '8px' }} onSubmit={handleSubmit}>
            <label htmlFor="account-current-password" className="sr-only">Current password</label>
            <input
              id="account-current-password"
              type="password"
              placeholder="Current password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <label htmlFor="account-new-password" className="sr-only">New password</label>
            <input
              id="account-new-password"
              type="password"
              placeholder="New password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {error && <p style={{ color: 'var(--orange)', fontSize: '0.85rem' }}>{error}</p>}
            {success && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Password updated.</p>}
            <button type="submit" style={{ marginTop: '10px' }} disabled={submitting}>
              {submitting ? "Please wait..." : "Change Password"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
