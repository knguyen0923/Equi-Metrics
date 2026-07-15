import { useState } from "react";
import Navbar from "../components/Navbar";
import Results from "./Results";
import AdvancedStats from "./AdvancedStats";

// 3. Advanced Stats Data (Moved here to act as state, eventually this will be fetched/calculated on the fly)
const defaultStats = [
  { model: "XGBRanker", top1: "60.89%", ndcg3: "81.96%", ndcg5: "83.05%", ndcg10: "84.75%" },
  { model: "CatBoost Ranker", top1: "46.97%", ndcg3: "83.17%", ndcg5: "84.23%", ndcg10: "85.62%" },
  { model: "LightGBM Ranker", top1: "45.80%", ndcg3: "52.84%", ndcg5: "54.59%", ndcg10: "55.17%" },
  { model: "Neural Network Ranker", top1: "52.01%", ndcg3: "76.34%", ndcg5: "77.84%", ndcg10: "81.24%" },
];

export default function SimulationSetup() {
  // --- State for the Form ---
  const [country, setCountry] = useState("");
  const [course, setCourse] = useState("");
  const [condition, setCondition] = useState("");
  const [selectedModel, setSelectedModel] = useState("XGBRanker");

  // --- State for the Results & Stats ---
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationStats, setSimulationStats] = useState(defaultStats);
  const [isSimulating, setIsSimulating] = useState(false);

  // 1. Eventually this function will call your actual local models/API.
  const handleRunSimulation = () => {
    setIsSimulating(true);

    // Simulating a network request / model prediction delay
    setTimeout(() => {
      // Mocking dynamic data generation based on the selected model
      const mockDynamicResults = [
        { rank: 1, horse: "Goldship", predictedRank: 1, probability: 72, odds: "4-1", model: selectedModel },
        { rank: 2, horse: "The Hawkstonian", predictedRank: 2, probability: 48, odds: "6-1", model: selectedModel },
        { rank: 3, horse: "Skibidi Rizz", predictedRank: 4, probability: 31, odds: "8-1", model: selectedModel },
      ];
      
      setSimulationResults(mockDynamicResults);
      // Here you could also update `setSimulationStats` if the stats change per simulation
      setIsSimulating(false);
    }, 800);
  };

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

            <button onClick={handleRunSimulation} disabled={isSimulating}>
              {isSimulating ? "Running..." : "Run Simulation"}
            </button>
          </div>
        </section>

        {/* Passing the dynamic state down to the child components as props */}
        <Results data={simulationResults} />
        <AdvancedStats metrics={simulationStats} selectedModel={selectedModel} />
      </main>
    </>
  );
}