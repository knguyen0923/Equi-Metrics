import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

export default function Login() {
  // One page, three modes, so the login/signup/forgot-password forms can
  // share layout and state instead of being three separate page components.
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();

  function switchMode(next) {
    setMode(next);
    // Clear any leftover message from the previous mode so, e.g., a login
    // error doesn't still show after switching to the signup form.
    setError("");
    setInfo("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
        navigate("/");
      } else if (mode === "signup") {
        await signup(email, password);
        navigate("/");
      } else {
        // Forgot-password: the backend always responds the same way whether
        // or not the email is registered, so there's no way to tell from
        // here whether an email actually went out.
        await api.forgotPassword(email);
        setInfo("If that email is registered, a reset link has been sent.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const heading = mode === "forgot" ? "Reset Password" : mode === "signup" ? "Create Account" : "Welcome Back";
  const subheading =
    mode === "forgot"
      ? "Enter your email to receive a reset link."
      : mode === "signup"
      ? "Sign up to save your simulations and track your history."
      : "Log in to access your saved models.";

  return (
    <>
      <Navbar />
      <main className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <section className="setup-card" style={{ width: '100%', maxWidth: '400px' }}>
          <div className="section-heading" style={{ textAlign: 'center' }}>
            <h2>{heading}</h2>
            <p style={{ color: 'var(--text-muted)' }}>{subheading}</p>
          </div>

          <form className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '8px' }} onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {/* Forgot-password mode only asks for an email; login/signup also need a password */}
            {mode !== "forgot" && (
              <>
                <input
                  type="password"
                  placeholder="Password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {/* Forgot Password link directly beneath the password input */}
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      textAlign: 'right',
                      cursor: 'pointer',
                      marginBottom: '16px',
                      padding: '0'
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </>
            )}

            {error && <p style={{ color: 'var(--orange)', fontSize: '0.85rem' }}>{error}</p>}
            {info && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{info}</p>}

            <button type="submit" style={{ marginTop: '10px' }} disabled={submitting}>
              {submitting
                ? "Please wait..."
                : mode === "forgot"
                ? "Send Reset Link"
                : mode === "signup"
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          {/* Toggle back to login, or between login/signup */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            {mode === "login" && (
              <button onClick={() => switchMode("signup")} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.9rem' }}>
                Need an account? Sign up
              </button>
            )}
            {mode === "signup" && (
              <button onClick={() => switchMode("login")} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.9rem' }}>
                Already have an account? Log in
              </button>
            )}
            {mode === "forgot" && (
              <button onClick={() => switchMode("login")} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.9rem' }}>
                Back to Login
              </button>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
