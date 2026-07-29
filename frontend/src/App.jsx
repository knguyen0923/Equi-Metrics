import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SimulationSetup from "./pages/SimulationSetup";
import About from "./pages/About";
import History from "./pages/History";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

function App() {
  return (
    // AuthProvider sits above the Router so every route (and Navbar, which
    // renders outside <Routes> on the login/account pages) can read login
    // state via useAuth().
    <AuthProvider>
      {/* Router manages the URL state across the app */}
      <Router>
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
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;