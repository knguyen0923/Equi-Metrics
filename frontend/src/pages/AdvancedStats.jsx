const modelMetrics = [
  {
    model: "XGBRanker",
    top1: "60.89%",
    ndcg3: "81.96%",
    ndcg5: "83.05%",
    ndcg10: "84.75%",
  },
  {
    model: "CatBoost Ranker",
    top1: "46.97%",
    ndcg3: "83.17%",
    ndcg5: "84.23%",
    ndcg10: "85.62%",
  },
  {
    model: "LightGBM Ranker",
    top1: "45.80%",
    ndcg3: "52.84%",
    ndcg5: "54.59%",
    ndcg10: "55.17%",
  },
  {
    model: "Neural Network Ranker",
    top1: "52.01%",
    ndcg3: "76.34%",
    ndcg5: "77.84%",
    ndcg10: "81.24%",
  },
  {
    model: "Random Forest Ranker",
    top1: "58.85%",
    ndcg3: "48.63%",
    ndcg5: "49.45%",
    ndcg10: "49.53%",
  },
  {
    model: "Decision Tree Ranker",
    top1: "60.87%",
    ndcg3: "48.38%",
    ndcg5: "49.33%",
    ndcg10: "49.43%",
  },
];

export default function AdvancedStats() {
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
            {modelMetrics.map((row) => (
              <tr key={row.model}>
                <td>{row.model}</td>
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