import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Navbar() {
  // Renders on every page — this is what makes the "Login" link swap for
  // the user's email + a Logout button app-wide once they're signed in.
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout(); // clears the stored JWT and local user state
    navigate("/"); // send them back to the home page after logging out
  }

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
        {user ? (
          <>
            {/* Account link keeps the login-link class for consistent styling */}
            <Link className="login-link" to="/account">{user.email}</Link>
            <button
              type="button"
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link className="login-link" to="/login">Login</Link>
        )}
      </nav>
    </header>
  );
}
