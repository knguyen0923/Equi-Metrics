import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

export default function History() {
  const { user, loading } = useAuth();
  const [simulations, setSimulations] = useState([]);
  const [error, setError] = useState("");

  // Only fetches once we know who the user is (or that there isn't one).
  // Re-runs if `user` changes, e.g. after logging in while already on this page.
  useEffect(() => {
    if (!user) return;
    api
      .getHistory()
      .then(setSimulations)
      .catch((err) => setError(err.message));
  }, [user]);

  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ marginTop: '40px' }}>
          <div className="section-heading">
            <h2>Simulation History</h2>
            <p>Review your previously run prediction models.</p>
          </div>

          {/* loading: still checking for a saved session, don't flash a "log in" prompt first */}
          {loading ? null : !user ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <p>Log in to view your simulation history.</p>
            </div>
          ) : error ? (
            <p style={{ color: 'var(--orange)' }}>{error}</p>
          ) : simulations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <p>No simulations yet — run one from the Home page while logged in.</p>
            </div>
          ) : (
            <div className="model-table-card">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Track</th>
                    <th>Model Used</th>
                    <th>Predicted Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((sim) => (
                    <tr key={sim.id}>
                      <td>{sim.date}</td>
                      <td>{sim.track}</td>
                      <td>{sim.model}</td>
                      <td style={{ color: 'var(--orange-light)' }}>{sim.winner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
