// 3. Stats are now pulled from the `metrics` prop, allowing them to be calculated on the fly in the parent component.
// `metrics` is fetched by the parent (SimulationSetup) from GET /simulations/stats.

export default function AdvancedStats({ metrics, selectedModel }) {
  if (!metrics) return null; // Don't render if there's no data yet (still loading, or the fetch failed)

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

      {/* These 4 headline numbers are still hardcoded rather than derived
          from `metrics` — they happen to match the current stats, but
          won't update automatically if the underlying numbers ever change. */}
      <div className="stat-card-grid">
        <article className="stat-card">
          <h3>60.89%</h3>
          <p>XGBRanker Top-1 Accuracy</p>
        </article>

        <article className="stat-card">
          <h3>85.62%</h3>
          <p>Best NDCG@10 — CatBoost Ranker</p>
        </article>

        <article className="stat-card">
          <h3>52.01%</h3>
          <p>Neural Network Top-1 Accuracy</p>
        </article>

        <article className="stat-card">
          <h3>1,495</h3>
          <p>Valid single-winner test races</p>
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