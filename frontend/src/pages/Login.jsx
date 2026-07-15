import Navbar from "../components/Navbar";

export default function Login() {
  return (
    <>
      <Navbar />
      <main className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <section className="setup-card" style={{ width: '100%', maxWidth: '400px' }}>
          <div className="section-heading" style={{ textAlign: 'center' }}>
            <h2>Welcome Back</h2>
            <p>Log in to access your saved models.</p>
          </div>

          {/* Re-using your form-grid class for quick styling */}
          <form className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }} onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Email address" required />
            <input type="password" placeholder="Password" required />
            <button type="submit" style={{ marginTop: '10px' }}>Sign In</button>
          </form>
        </section>
      </main>
    </>
  );
}