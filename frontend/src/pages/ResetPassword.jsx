import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";

// Landed on via the link in the reset-password email:
// {FRONTEND_URL}/reset-password?token=<raw token>
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      // Brief pause so the "password reset" confirmation is actually
      // readable before redirecting to log in with the new password.
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <section className="setup-card" style={{ width: '100%', maxWidth: '400px' }}>
          <div className="section-heading" style={{ textAlign: 'center' }}>
            <h2>Set a New Password</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              {/* Someone could land here without a token by visiting the URL directly */}
              {token ? "Choose a new password for your account." : "This reset link is missing its token."}
            </p>
          </div>

          {!done ? (
            <form className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '8px' }} onSubmit={handleSubmit}>
              <label htmlFor="reset-new-password" className="sr-only">New password</label>
              <input
                id="reset-new-password"
                type="password"
                placeholder="New password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!token}
              />
              {error && <p style={{ color: 'var(--orange)', fontSize: '0.85rem' }}>{error}</p>}
              <button type="submit" style={{ marginTop: '10px' }} disabled={!token || submitting}>
                {submitting ? "Please wait..." : "Reset Password"}
              </button>
            </form>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              Password reset. Redirecting to login...
            </p>
          )}
        </section>
      </main>
    </>
  );
}
