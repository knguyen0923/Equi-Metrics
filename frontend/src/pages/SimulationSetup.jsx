import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import RealRaceSetup from "../components/RealRaceSetup";
import CustomRaceSetup from "../components/CustomRaceSetup";
import Results from "./Results";
import AdvancedStats from "./AdvancedStats";
import { useAuth } from "../context/useAuth";
import { useDebouncedSearch } from "../lib/useDebouncedSearch";
import { api } from "../lib/api";

// Only XGBRanker was ever exported as a loadable model file (see
// backend/app/ml/registry.py) — there's no dropdown for it since it's the
// only option, but AdvancedStats still uses this to highlight its row.
const ACTIVE_MODEL = "XGBRanker";

export default function SimulationSetup() {
  const [mode, setMode] = useState("real"); // "real" | "custom"

  // --- State for the real-race picker ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRace, setSelectedRace] = useState(null);
  // Races are real historical races the model was never trained on (see
  // backend/app/ml/registry.py), not arbitrary course/condition combos, so
  // users search/pick instead of configuring one. Only fetches once the
  // user has actually typed something, rather than showing an unfiltered
  // default list of the most recent races.
  const [raceOptions, setRaceOptions] = useDebouncedSearch(
    searchTerm,
    mode === "real" && searchTerm.length > 0,
    api.getRaces
  );

  // --- State for the custom race builder ---
  const [contextOptions, setContextOptions] = useState(null);
  const [context, setContext] = useState({
    course: "",
    going: "",
    race_class: "",
    region: "",
    surface: "",
    distance_category: "",
  });
  const [horseSearchTerm, setHorseSearchTerm] = useState("");
  const [horseOptions, setHorseOptions] = useDebouncedSearch(horseSearchTerm, mode === "custom", api.searchHorses);
  const [selectedHorses, setSelectedHorses] = useState([]);

  // --- State for the Results & Stats ---
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationStats, setSimulationStats] = useState(null);
  const [totalRaces, setTotalRaces] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const { user } = useAuth();

  // Model-evaluation metrics now live on the backend (GET /simulations/stats)
  // instead of being hardcoded here, so they only need to change in one place.
  useEffect(() => {
    api.getStats().then(setSimulationStats).catch(() => {});
    api.getRaceCount().then((r) => setTotalRaces(r.total)).catch(() => {});
    api.getRaceContextOptions().then(setContextOptions).catch(() => {});
  }, []);

  function handleSearchTermChange(value) {
    setSearchTerm(value);
    setSelectedRace(null);
  }

  function handleSelectRace(race) {
    setSelectedRace(race);
    setRaceOptions([]);
  }

  function handleClearRace() {
    setSelectedRace(null);
    setSearchTerm("");
  }

  function handleContextChange(field, value) {
    setContext({ ...context, [field]: value });
  }

  function handleAddHorse(horse) {
    if (selectedHorses.some((h) => h.profileId === horse.profileId)) return;
    setSelectedHorses([...selectedHorses, horse]);
    setHorseSearchTerm("");
    setHorseOptions([]);
  }

  function handleRemoveHorse(profileId) {
    setSelectedHorses(selectedHorses.filter((h) => h.profileId !== profileId));
  }

  const contextComplete = Object.values(context).every(Boolean);
  const canRunCustom = contextComplete && selectedHorses.length >= 3;

  async function runWithWakeupNotice(fn) {
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
      const response = await fn();
      setSimulationResults(response.results);
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(wakeupTimer);
      setIsSimulating(false);
      setStatusMessage("");
    }
  }

  function handleRunSimulation() {
    runWithWakeupNotice(() => api.runSimulation({ race_key: selectedRace.raceKey }));
  }

  function handleRunCustomSimulation() {
    runWithWakeupNotice(() =>
      api.runCustomSimulation({
        ...context,
        profile_ids: selectedHorses.map((h) => h.profileId),
      })
    );
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setSimulationResults(null);
    setError("");
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
            <p>
              {mode === "real"
                ? "Search for a real historical race to run the model against."
                : "Assemble your own race from real horses and a race context you choose."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => switchMode("real")}
              style={{ fontWeight: mode === "real" ? "bold" : "normal" }}
            >
              Real Race
            </button>
            <button
              type="button"
              onClick={() => switchMode("custom")}
              style={{ fontWeight: mode === "custom" ? "bold" : "normal" }}
            >
              Custom Race
            </button>
          </div>

          {mode === "real" ? (
            <RealRaceSetup
              activeModel={ACTIVE_MODEL}
              searchTerm={searchTerm}
              onSearchTermChange={handleSearchTermChange}
              selectedRace={selectedRace}
              onSelectRace={handleSelectRace}
              onClearRace={handleClearRace}
              raceOptions={raceOptions}
              isSimulating={isSimulating}
              onRunSimulation={handleRunSimulation}
            />
          ) : (
            <CustomRaceSetup
              contextOptions={contextOptions}
              context={context}
              onContextChange={handleContextChange}
              horseSearchTerm={horseSearchTerm}
              onHorseSearchTermChange={setHorseSearchTerm}
              horseOptions={horseOptions}
              onAddHorse={handleAddHorse}
              selectedHorses={selectedHorses}
              onRemoveHorse={handleRemoveHorse}
              canRunCustom={canRunCustom}
              isSimulating={isSimulating}
              onRunCustomSimulation={handleRunCustomSimulation}
            />
          )}

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

        {/* Every result is real model output now (see backend/app/ml/registry.py) */}
        <Results data={simulationResults} />
        <AdvancedStats metrics={simulationStats} selectedModel={ACTIVE_MODEL} totalRaces={totalRaces} />
      </main>
    </>
  );
}
