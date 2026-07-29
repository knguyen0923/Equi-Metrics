// `data` is the array of ranked horses from a simulation run, or null if
// none has run yet.
export default function Results({ data }) {
  return (
    <section className="results-section">
      <div className="section-heading">
        <p className="eyebrow">Simulation Results</p>
        <h2>Predicted Race Outcome</h2>
        <p>
          Results are ranked using the selected machine learning model and shown
          by predicted finishing order.
        </p>
      </div>

      {/* If data is null (simulation hasn't run yet), show a prompt */}
      {!data ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
          <p>Please configure and run a simulation to view predicted outcomes.</p>
        </div>
      ) : (
        <div className="results-grid">
          {data.map((horse) => (
            <article className="result-card" key={horse.horse}>
              <div className="result-rank">#{horse.rank}</div>

              <div>
                <h3>{horse.horse}</h3>
                <p>Model: {horse.model}</p>
              </div>

              <div className="probability-bar">
                <span style={{ width: `${horse.probability}%` }}></span>
              </div>

              <div className="result-meta">
                <p>
                  <strong>{horse.probability}%</strong>
                  <span>Win probability</span>
                </p>
                <p>
                  <strong>{horse.odds}</strong>
                  <span>Odds</span>
                </p>
                <p>
                  <strong>{horse.predictedRank}</strong>
                  <span>Predicted rank</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}