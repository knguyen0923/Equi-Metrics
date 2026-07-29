import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

// Catch-all for any URL that doesn't match a real route — without this,
// react-router's <Routes> renders nothing at all for an unknown path,
// which looks like the app is broken rather than a bad/stale link.
export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
          <div className="section-heading">
            <h2>Page not found</h2>
            <p>There's nothing at this address.</p>
          </div>
          <Link to="/">Back to Home</Link>
        </section>
      </main>
    </>
  );
}
