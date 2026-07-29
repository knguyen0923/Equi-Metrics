import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// Route-level code splitting: each page only downloads when a user
// actually navigates to it, instead of all of them bloating the one
// initial bundle every visitor pays for regardless of which pages (if any)
// they ever visit.
const SimulationSetup = lazy(() => import("./pages/SimulationSetup"));
const About = lazy(() => import("./pages/About"));
const History = lazy(() => import("./pages/History"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));

function App() {
  return (
    // AuthProvider sits above the Router so every route (and Navbar, which
    // renders outside <Routes> on the login/account pages) can read login
    // state via useAuth().
    <AuthProvider>
      {/* Router manages the URL state across the app */}
      <Router>
        {/* Catches a render crash anywhere below and shows a fallback
            instead of a blank page — inside Router/AuthProvider so its own
            Navbar still has routing/auth context available. */}
        <ErrorBoundary>
          {/* Shown only while a lazy-loaded page's own chunk is still being
              fetched — typically imperceptible on a normal connection. */}
          <Suspense fallback={<div className="page" style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>Loading…</div>}>
            <Routes>
              {/* Each Route renders the component when the path matches the URL */}
              <Route path="/" element={<SimulationSetup />} />
              <Route path="/about" element={<About />} />
              <Route path="/history" element={<History />} />
              <Route path="/login" element={<Login />} />
              {/* Reached via the emailed reset link: /reset-password?token=... */}
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Change-password page; redirects to /login itself if not signed in */}
              <Route path="/account" element={<Account />} />
              {/* Any URL that doesn't match one of the routes above */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}

export default App;