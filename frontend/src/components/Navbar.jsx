import { Link } from "react-router-dom";

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
        {/* Link components handle internal routing without browser refreshes */}
        <Link to="/">Home</Link>
        <Link to="/history">History</Link>
        <Link to="/about">About Us</Link>
        {/* Login link keeps its class for specific styling */}
        <Link className="login-link" to="/login">Login</Link>
      </nav>
    </header>
  );
}