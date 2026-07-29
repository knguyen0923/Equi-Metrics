import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Results from "./Results";
import AdvancedStats from "./AdvancedStats";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

export default function SimulationSetup() {
  // --- State for the Form ---
  const [country, setCountry] = useState("");
  const [course, setCourse] = useState("");
  const [condition, setCondition] = useState("");
  const [selectedModel, setSelectedModel] = useState("XGBRanker");

  // --- State for the Results & Stats ---
  const [simulationResults, setSimulationResults] = useState(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  const [simulationStats, setSimulationStats] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const { user } = useAuth();

  // Model-evaluation metrics now live on the backend (GET /simulations/stats)
  // instead of being hardcoded here, so they only need to change in one place.
  useEffect(() => {
    api.getStats().then(setSimulationStats).catch(() => {});
  }, []);

  async function handleRunSimulation() {
    setIsSimulating(true);
    setError("");
    setStatusMessage("Running simulation...");

    // Render's free tier spins the API down after inactivity, so the first
    // request after idle can take up to ~60s to wake it back up. Only show
    // this message if the request is actually taking a while, so it doesn't
    // flash on every normal, fast request.
    const wakeupTimer = setTimeout(() => {
      setStatusMessage("Waking up the server... this can take up to a minute on first load.");
    }, 4000);

    try {
      // Backend returns synthetic-but-labeled results today (see
      // backend/app/ml/registry.py) — isPlaceholder tells Results whether
      // to show the "preview data" badge.
      const response = await api.runSimulation({ country, course, condition, model: selectedModel });
      setSimulationResults(response.results);
      setIsPlaceholder(response.isPlaceholder);
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(wakeupTimer);
      setIsSimulating(false);
      setStatusMessage("");
    }
  }

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

            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Select country</option>
              <option value="GB">GB</option>
              <option value="FR">FR</option>
              <option value="IE">IE</option>
              <option value="US">US</option>
              <option value="HK">HK</option>
            </select>

            {/* option values (e.g. "SantaAnita") are what's sent to the API;
                labels (e.g. "Santa Anita") are just for display — must match
                backend/app/models/simulation.py's Course enum */}
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Select race course</option>
              <option value="Ascot">Ascot</option>
              <option value="Belmont">Belmont Park</option>
              <option value="SantaAnita">Santa Anita</option>
              <option value="Churchill">Churchill Downs</option>
            </select>

            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Track condition</option>
              <option value="Firm">Firm</option>
              <option value="Good">Good</option>
              <option value="Soft">Soft</option>
              <option value="Heavy">Heavy</option>
            </select>

            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              <option value="XGBRanker">XGBRanker</option>
              <option value="CatBoost Ranker">CatBoost Ranker</option>
              <option value="LightGBM Ranker">LightGBM Ranker</option>
              <option value="Neural Network Ranker">Neural Network Ranker</option>
            </select>

            {/* Disabled until all three race fields are chosen, so the
                request can't be submitted with blank values */}
            <button onClick={handleRunSimulation} disabled={isSimulating || !country || !course || !condition}>
              {isSimulating ? "Running..." : "Run Simulation"}
            </button>
          </div>

          {statusMessage && <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>{statusMessage}</p>}
          {error && <p style={{ color: 'var(--orange)', marginTop: '8px' }}>{error}</p>}
          {/* Simulations run without logging in, but only get saved to
              history if the user was logged in at the time — see
              backend/app/routers/simulations.py's run_simulation */}
          {!user && simulationResults && (
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
              Log in to save this result to your history.
            </p>
          )}
        </section>

        {/* Passing the dynamic state down to the child components as props */}
        <Results data={simulationResults} isPlaceholder={isPlaceholder} />
        <AdvancedStats metrics={simulationStats} selectedModel={selectedModel} />
      </main>
    </>
  );
}
