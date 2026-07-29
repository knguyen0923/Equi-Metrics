import { Component } from "react";
import Navbar from "./Navbar";

// Error boundaries have to be class components — React has no hook
// equivalent for getDerivedStateFromError/componentDidCatch. Wraps the
// whole app (see App.jsx) so an unexpected render crash anywhere shows a
// friendly fallback instead of the blank white screen React leaves behind
// by default when nothing catches the error.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // No error-tracking service (Sentry, etc.) is wired up — this is the
    // one place a render crash is at least visible, in the browser console,
    // rather than only showing up as "the page went blank" with no trace.
    console.error("Unhandled error in the app:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <>
        <Navbar />
        <main className="page">
          <section className="setup-card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
            <div className="section-heading">
              <h2>Something went wrong</h2>
              <p>An unexpected error occurred. Reloading the page usually fixes this.</p>
            </div>
            <button type="button" onClick={() => window.location.assign("/")}>
              Back to Home
            </button>
          </section>
        </main>
      </>
    );
  }
}
