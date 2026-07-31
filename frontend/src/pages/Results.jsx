// `data` is the array of ranked horses from a simulation run, or null if
// none has run yet. Rendered as a racecard — one row per runner, in
// predicted finishing order — rather than a card grid, since a real field
// can now run up to 18 horses (see SimulationSetup.jsx's MAX_FIELD_SIZE).
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
        <div className="race-card">
          <div className="race-card-header">
            <span>Pos</span>
            <span>Runner</span>
            <span>Win %</span>
            <span>Odds</span>
          </div>

          {data.map((horse) => {
            const isWinner = horse.rank === 1;
            const details = [
              horse.jockey,
              horse.trainer,
              horse.age != null ? `Age ${horse.age}` : null,
              horse.officialRating != null ? `OR ${horse.officialRating}` : null,
            ].filter(Boolean);

            return (
              <article
                className={`race-card-row${isWinner ? " race-card-row--winner" : ""}`}
                key={horse.horse}
              >
                <div className={`race-card-badge${isWinner ? " race-card-badge--winner" : ""}`}>
                  {horse.rank}
                </div>

                <div className="race-card-runner">
                  <h3>
                    {horse.horse}
                    {isWinner && <span className="race-card-tag">Predicted winner</span>}
                  </h3>
                  {details.length > 0 && <p className="race-card-subline">{details.join(" • ")}</p>}
                </div>

                <div className="race-card-probability">
                  <div className="probability-bar">
                    <span style={{ width: `${horse.probability}%` }}></span>
                  </div>
                  <strong>{horse.probability}%</strong>
                </div>

                <div className="race-card-odds">{horse.odds}</div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}