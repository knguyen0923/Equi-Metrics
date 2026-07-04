export default function Navbar() {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="logo">EM</div>
        <div>
          <h1>Equi-Metrics</h1>
          <p>AI-powered horse racing analytics</p>
        </div>
      </div>

      <nav>
        <a href="/">Home</a>
        <a href="/history">History</a>
        <a href="/about">About Us</a>
        <a href="/feedback">Feedback</a>
        <a className="login-link" href="/login">Login</a>
      </nav>
    </header>
  );
}