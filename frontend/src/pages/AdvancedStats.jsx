// Stats are pulled from the `metrics` prop (GET /simulations/stats) and
// `totalRaces` (GET /simulations/races/count), both fetched by the parent
// (SimulationSetup), so the headline numbers stay in sync with whatever the
// backend actually reports instead of drifting from a hardcoded snapshot.

function parsePercent(value) {
  return parseFloat(String(value).replace('%', ''));
}

export default function AdvancedStats({ metrics, selectedModel, totalRaces }) {
  // Covers both "hasn't loaded yet" (null) and "loaded but empty" (an
  // empty array) — metrics[0] would otherwise be undefined and crash the
  // reduce() below.
  if (!metrics || metrics.length === 0) return null;

  const activeModelStats = metrics.find((row) => row.model === selectedModel);
  const bestNdcg10 = metrics.reduce(
    (best, row) => (parsePercent(row.ndcg10) > parsePercent(best.ndcg10) ? row : best),
    metrics[0]
  );

  return (
    <section className="advanced-section">
      <div className="section-heading">
        <p className="eyebrow">Model Evaluation</p>
        <h2>Advanced Statistics</h2>
        <p>
          These metrics compare the ranking models used in the Equi-Metrics
          prediction pipeline.
        </p>
      </div>

      <div className="stat-card-grid">
        {activeModelStats && (
          <>
            <article className="stat-card">
              <h3>{activeModelStats.top1}</h3>
              <p>{activeModelStats.model} Top-1 Accuracy</p>
            </article>

            <article className="stat-card">
              <h3>{activeModelStats.ndcg10}</h3>
              <p>{activeModelStats.model} NDCG@10</p>
            </article>
          </>
        )}

        <article className="stat-card">
          <h3>{bestNdcg10.ndcg10}</h3>
          <p>Best NDCG@10 — {bestNdcg10.model}</p>
        </article>

        <article className="stat-card">
          <h3>{totalRaces != null ? totalRaces.toLocaleString() : "—"}</h3>
          <p>Real historical races available to simulate</p>
        </article>
      </div>

      <div className="model-table-card">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Top-1</th>
              <th>NDCG@3</th>
              <th>NDCG@5</th>
              <th>NDCG@10</th>
            </tr>
          </thead>

          <tbody>
            {metrics.map((row) => (
              <tr 
                key={row.model} 
                // Highlight the row if it matches the model the user selected in the dropdown!
                style={{ 
                  backgroundColor: row.model === selectedModel ? 'var(--bg-card-soft)' : 'transparent',
                  borderLeft: row.model === selectedModel ? '3px solid var(--orange)' : 'none'
                }}
              >
                <td style={{ fontWeight: row.model === selectedModel ? 'bold' : 'normal', color: row.model === selectedModel ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  {row.model}
                </td>
                <td>{row.top1}</td>
                <td>{row.ndcg3}</td>
                <td>{row.ndcg5}</td>
                <td>{row.ndcg10}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}