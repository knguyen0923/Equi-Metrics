import { useState } from "react";
import Navbar from "../components/Navbar";

export default function Login() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  return (
    <>
      <Navbar />
      <main className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <section className="setup-card" style={{ width: '100%', maxWidth: '400px' }}>
          <div className="section-heading" style={{ textAlign: 'center' }}>
            <h2>{isForgotPassword ? "Reset Password" : "Welcome Back"}</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              {isForgotPassword 
                ? "Enter your email to receive a reset link." 
                : "Log in to access your saved models."}
            </p>
          </div>

          <form className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '8px' }} onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Email address" required />
            
            {!isForgotPassword && (
              <>
                <input type="password" placeholder="Password" required />
                
                {/* Forgot Password link directly beneath the password input */}
                <button 
                  type="button" 
                  onClick={() => setIsForgotPassword(true)} 
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
              </>
            )}

            <button type="submit" style={{ marginTop: '10px' }}>
              {isForgotPassword ? "Send Reset Link" : "Sign In"}
            </button>
          </form>

          {/* Toggle back to login if in reset mode */}
          {isForgotPassword && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button 
                onClick={() => setIsForgotPassword(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Back to Login
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}