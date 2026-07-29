import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Results from "./Results";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

export default function History() {
  const { user, loading } = useAuth();
  const [simulations, setSimulations] = useState([]);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  // Only fetches once we know who the user is (or that there isn't one).
  // Re-runs if `user` changes, e.g. after logging in while already on this page.
  useEffect(() => {
    if (!user) return;
    api
      .getHistory()
      .then(setSimulations)
      .catch((err) => setError(err.message));
  }, [user]);

  function handleRowClick(sim) {
    // Clicking the already-open row collapses it instead of re-fetching.
    if (selectedId === sim.id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(sim.id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    api
      .getHistoryDetail(sim.id)
      .then(setDetail)
      .catch((err) => setDetailError(err.message))
      .finally(() => setDetailLoading(false));
  }

  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ marginTop: '40px' }}>
          <div className="section-heading">
            <h2>Simulation History</h2>
            <p>Review your previously run prediction models. Click a row for the full ranking breakdown.</p>
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
                    <tr
                      key={sim.id}
                      onClick={() => handleRowClick(sim)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: selectedId === sim.id ? 'var(--bg-card-soft)' : 'transparent',
                      }}
                    >
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

          {selectedId && (
            <div style={{ marginTop: "16px" }}>
              {detailLoading && <p style={{ color: 'var(--text-muted)' }}>Loading breakdown...</p>}
              {detailError && <p style={{ color: 'var(--orange)' }}>{detailError}</p>}
              {detail && (
                <>
                  <p style={{ color: 'var(--text-muted)' }}>
                    {detail.track} — {detail.date} — {detail.model}
                  </p>
                  <Results data={detail.results} isPlaceholder={false} />
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
