import Navbar from "../components/Navbar";
import Results from "./Results";
import AdvancedStats from "./AdvancedStats";


export default function SimulationSetup() {
  return (
    <>
      <Navbar />

      <main className="page">
        <section className="hero-panel">
          <div className="hero-content">
            <p className="eyebrow">Equi-Metrics Prediction Engine</p>
            <h1>Simulate. Predict. Analyze.</h1>
            <p>
              Run machine learning models on horse racing data and compare
              predicted race outcomes using ranking-based evaluation.
            </p>
          </div>
        </section>

        <section className="setup-card">
          <div className="section-heading">
            <h2>Race Simulation Setup</h2>
            <p>Select the race details and model you want to use.</p>
          </div>

          <div className="form-grid">
            <input placeholder="Search race..." />

            <select>
              <option>Select country</option>
              <option>GB</option>
              <option>FR</option>
              <option>IE</option>
              <option>US</option>
              <option>HK</option>
            </select>

            <select>
              <option>Select race course</option>
              <option>Ascot</option>
              <option>Belmont Park</option>
              <option>Santa Anita</option>
              <option>Churchill Downs</option>
            </select>

            <select>
              <option>Track condition</option>
              <option>Firm</option>
              <option>Good</option>
              <option>Soft</option>
              <option>Heavy</option>
              <option>Standard</option>
            </select>

            <select>
              <option>XGBRanker</option>
              <option>CatBoost Ranker</option>
              <option>LightGBM Ranker</option>
              <option>Neural Network Ranker</option>
              <option>Random Forest Ranker</option>
              <option>Decision Tree Ranker</option>
            </select>

            <button>Run Simulation</button>
          </div>
        </section>

        <Results />
        <AdvancedStats />
      </main>
    </>
  );
}