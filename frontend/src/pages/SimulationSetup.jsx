import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Results from "./Results";
import AdvancedStats from "./AdvancedStats";
import { useAuth } from "../context/useAuth";
import { api } from "../lib/api";

// Only XGBRanker was ever exported as a loadable model file (see
// backend/app/ml/registry.py) — there's no dropdown for it since it's the
// only option, but AdvancedStats still uses this to highlight its row.
const ACTIVE_MODEL = "XGBRanker";

const dropdownStyle = {
  position: "absolute",
  top: "44px",
  left: 0,
  right: 0,
  zIndex: 10,
  background: "var(--bg-card, #fff)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  maxHeight: "220px",
  overflowY: "auto",
  listStyle: "none",
  margin: 0,
  padding: "4px 0",
};

const dropdownItemStyle = {
  width: "100%",
  textAlign: "left",
  padding: "8px 12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
};

// Muted, smaller secondary text next to a course/horse name — the race
// date, a horse's last-seen course, its jockey.
const mutedSmallText = { fontSize: "0.75em", color: "var(--text-muted)" };

// A borderless, inline "ghost" action button — "Change" on the selected
// race, "Remove" on a selected horse.
const ghostButtonStyle = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-muted)",
};

// Debounces `term` and calls `fetchFn(term)` 300ms after it stops
// changing, skipping entirely while `enabled` is false (e.g. the other
// mode is active). Shared by the real-race and horse searches below —
// only the term/fetch function differ between them. Returns a
// [results, setResults] pair (like useState) so callers can still clear
// the list immediately on selection, without waiting for the next debounce.
function useDebouncedSearch(term, enabled, fetchFn, delay = 300) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      fetchFn(term).then(setResults).catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [term, enabled, fetchFn, delay]);

  return [results, setResults];
}

export default function SimulationSetup() {
  const [mode, setMode] = useState("real"); // "real" | "custom"

  // --- State for the real-race picker ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRace, setSelectedRace] = useState(null);
  // Races are real historical races the model was never trained on (see
  // backend/app/ml/registry.py), not arbitrary course/condition combos, so
  // users search/pick instead of configuring one.
  const [raceOptions, setRaceOptions] = useDebouncedSearch(searchTerm, mode === "real", api.getRaces);

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

  function handleSelectRace(race) {
    setSelectedRace(race);
    setRaceOptions([]);
  }

  function handleClearRace() {
    setSelectedRace(null);
    setSearchTerm("");
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
            <div className="form-grid" style={{ position: "relative" }}>
              {selectedRace ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "0 12px",
                  }}
                >
                  <span>{selectedRace.course}</span>
                  <span style={mutedSmallText}>{selectedRace.date}</span>
                  <button
                    type="button"
                    onClick={handleClearRace}
                    aria-label="Change race"
                    style={ghostButtonStyle}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <input
                  placeholder="Search race by course..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedRace(null);
                  }}
                />
              )}

              {!selectedRace && raceOptions.length > 0 && (
                <ul style={dropdownStyle}>
                  {raceOptions.map((race) => (
                    <li key={race.raceKey}>
                      <button type="button" onClick={() => handleSelectRace(race)} style={dropdownItemStyle}>
                        <span>{race.course}</span>
                        <span style={mutedSmallText}>{race.date}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Only XGBRanker was ever exported as a loadable model file (see
                  backend/app/ml/registry.py) — the others are shown greyed out
                  so it's clear more models are planned, not just missing. */}
              <select value={ACTIVE_MODEL} disabled title="Only XGBRanker is available right now">
                <option value="XGBRanker">XGBRanker</option>
                <option value="CatBoost Ranker">CatBoost Ranker (Coming soon)</option>
                <option value="LightGBM Ranker">LightGBM Ranker (Coming soon)</option>
                <option value="Neural Network Ranker">Neural Network Ranker (Coming soon)</option>
              </select>

              {/* Disabled until a real race has been picked from the search results */}
              <button onClick={handleRunSimulation} disabled={isSimulating || !selectedRace}>
                {isSimulating ? "Running..." : "Run Simulation"}
              </button>
            </div>
          ) : (
            <div>
              <div className="form-grid">
                <select value={context.course} onChange={(e) => setContext({ ...context, course: e.target.value })}>
                  <option value="">Course</option>
                  {contextOptions?.courses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select value={context.going} onChange={(e) => setContext({ ...context, going: e.target.value })}>
                  <option value="">Going</option>
                  {contextOptions?.goings.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                <select value={context.race_class} onChange={(e) => setContext({ ...context, race_class: e.target.value })}>
                  <option value="">Class</option>
                  {contextOptions?.classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select value={context.region} onChange={(e) => setContext({ ...context, region: e.target.value })}>
                  <option value="">Region</option>
                  {contextOptions?.regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <select value={context.surface} onChange={(e) => setContext({ ...context, surface: e.target.value })}>
                  <option value="">Surface</option>
                  {contextOptions?.surfaces.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={context.distance_category}
                  onChange={(e) => setContext({ ...context, distance_category: e.target.value })}
                >
                  <option value="">Distance</option>
                  {contextOptions?.distanceCategories.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div style={{ position: "relative", marginTop: "16px" }}>
                <input
                  placeholder="Search horses by name to add to the field..."
                  value={horseSearchTerm}
                  onChange={(e) => setHorseSearchTerm(e.target.value)}
                />

                {horseOptions.length > 0 && (
                  <ul style={dropdownStyle}>
                    {horseOptions.map((horse) => (
                      <li key={horse.profileId}>
                        <button type="button" onClick={() => handleAddHorse(horse)} style={dropdownItemStyle}>
                          <span>{horse.horse}</span>
                          <span style={mutedSmallText}>
                            last: {horse.lastCourse} — {horse.lastDate}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedHorses.length > 0 && (
                <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
                  {selectedHorses.map((horse) => (
                    <li
                      key={horse.profileId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: "6px 12px",
                        marginTop: "6px",
                      }}
                    >
                      <span>{horse.horse}</span>
                      <span style={mutedSmallText}>
                        {horse.jockey ? `Jockey: ${horse.jockey}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHorse(horse.profileId)}
                        aria-label={`Remove ${horse.horse}`}
                        style={ghostButtonStyle}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "0.85em" }}>
                Add at least 3 horses. Each horse's ratings/history come from their own real
                past races; how they rank against each other is recomputed for this field.
              </p>

              <button onClick={handleRunCustomSimulation} disabled={isSimulating || !canRunCustom} style={{ marginTop: "12px" }}>
                {isSimulating ? "Running..." : "Run Simulation"}
              </button>
            </div>
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
        <Results data={simulationResults} isPlaceholder={false} />
        <AdvancedStats metrics={simulationStats} selectedModel={ACTIVE_MODEL} totalRaces={totalRaces} />
      </main>
    </>
  );
}
