const raceResults = [
  {
    rank: 1,
    horse: "Goldship",
    predictedRank: 1,
    probability: 72,
    odds: "4-1",
    model: "XGBRanker",
  },
  {
    rank: 2,
    horse: "The Hawkstonian",
    predictedRank: 2,
    probability: 48,
    odds: "6-1",
    model: "XGBRanker",
  },
  {
    rank: 3,
    horse: "Skibidi Rizz",
    predictedRank: 4,
    probability: 31,
    odds: "8-1",
    model: "XGBRanker",
  },
];

export default function Results() {
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

      <div className="results-grid">
        {raceResults.map((horse) => (
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
    </section>
  );
}