import { useState } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

// Minimal account page — currently just change-password. Only reachable
// when logged in; bounces to /login otherwise.
export default function Account() {
  const { user, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ marginTop: '40px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="section-heading" style={{ textAlign: 'center' }}>
            <h2>Account</h2>
            <p style={{ color: 'var(--text-muted)' }}>{user.email}</p>
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
