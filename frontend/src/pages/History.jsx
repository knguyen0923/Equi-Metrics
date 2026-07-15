import Navbar from "../components/Navbar";

// Dummy data for past simulations
const pastSimulations = [
  { id: 1, date: "2026-07-15", track: "Ascot", model: "XGBRanker", winner: "Goldship" },
  { id: 2, date: "2026-07-14", track: "Churchill Downs", model: "Neural Net", winner: "Skibidi Rizz" },
  { id: 3, date: "2026-07-10", track: "Santa Anita", model: "CatBoost", winner: "The Hawkstonian" },
];

export default function History() {
  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ marginTop: '40px' }}>
          <div className="section-heading">
            <h2>Simulation History</h2>
            <p>Review your previously run prediction models.</p>
          </div>

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
                {pastSimulations.map((sim) => (
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
        </section>
      </main>
    </>
  );
}