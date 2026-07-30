import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import CustomRaceSetup from "../components/CustomRaceSetup";
import Results from "./Results";
import AdvancedStats from "./AdvancedStats";
import { useAuth } from "../context/useAuth";
import { useDebouncedSearch } from "../lib/useDebouncedSearch";
import { api } from "../lib/api";

// Only XGBRanker was ever exported as a loadable model file (see
// backend/app/ml/registry.py) — AdvancedStats uses this to highlight its row.
const ACTIVE_MODEL = "XGBRanker";

// "Populate Random"/"Populate Class 1" top the field up to this size rather
// than adding an unbounded pile of horses on repeated clicks.
const TARGET_FIELD_SIZE = 6;

export default function SimulationSetup() {
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
  // Only fetches once the user has actually typed something — without this,
  // it fetched on mount with an empty search term, which the backend
  // resolves to the first 20 horses alphabetically (see
  // registry.search_horses) and made it look like the horse pool was tiny
  // and entirely "A"-named, since that's all that ever showed up.
  const [horseOptions, setHorseOptions] = useDebouncedSearch(
    horseSearchTerm,
    horseSearchTerm.length > 0,
    api.searchHorses
  );
  const [selectedHorses, setSelectedHorses] = useState([]);
  const [populateMessage, setPopulateMessage] = useState("");

  // --- State for the Results & Stats ---
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationStats, setSimulationStats] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const { user } = useAuth();

  // Model-evaluation metrics now live on the backend (GET /simulations/stats)
  // instead of being hardcoded here, so they only need to change in one place.
  useEffect(() => {
    api.getStats().then(setSimulationStats).catch(() => {});
    api.getRaceContextOptions().then(setContextOptions).catch(() => {});
  }, []);

  function handleContextChange(field, value) {
    // Course and region can be set in either order — a course only ever
    // occurs in one region in the data (see backend/app/ml/registry.py's
    // _COURSE_TO_REGION), so the two must never drift into a combination
    // that never occurs for real:
    //  - picking a region narrows CustomRaceSetup's course dropdown to that
    //    region's courses (see its own render logic);
    //  - picking a course always snaps region to match it, whether or not
    //    a region was chosen first;
    //  - picking a *different* region than an already-selected course's
    //    own region clears that course, since it's no longer a valid pick
    //    under the new filter.
    let next = { ...context, [field]: value };

    if (field === "region" && next.course && contextOptions?.courseRegions?.[next.course] !== value) {
      next.course = "";
    }
    if (next.course) {
      next.region = contextOptions?.courseRegions?.[next.course] ?? next.region;
    }

    setContext(next);
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

  async function populateHorses(raceClass) {
    setPopulateMessage("");
    const needed = TARGET_FIELD_SIZE - selectedHorses.length;
    if (needed <= 0) {
      setPopulateMessage(`Your field already has ${TARGET_FIELD_SIZE} horses.`);
      return;
    }
    try {
      const candidates = await api.populateHorses({ raceClass, limit: 20 });
      const fresh = candidates
        .filter((h) => !selectedHorses.some((s) => s.profileId === h.profileId))
        .slice(0, needed);
      if (fresh.length > 0) {
        setSelectedHorses([...selectedHorses, ...fresh]);
      } else {
        setPopulateMessage(raceClass ? `No new ${raceClass} horses to add.` : "No new horses to add.");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function handlePopulateRandom() {
    populateHorses();
  }

  function handlePopulateClassOne() {
    populateHorses("Class 1");
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

  function handleRunCustomSimulation() {
    runWithWakeupNotice(() =>
      api.runCustomSimulation({
        ...context,
        profile_ids: selectedHorses.map((h) => h.profileId),
      })
    );
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
            <p>Assemble your own race from real horses and a race context you choose.</p>
          </div>

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
            onPopulateRandom={handlePopulateRandom}
            onPopulateClassOne={handlePopulateClassOne}
            populateMessage={populateMessage}
            canRunCustom={canRunCustom}
            isSimulating={isSimulating}
            onRunCustomSimulation={handleRunCustomSimulation}
          />

          {statusMessage && <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>{statusMessage}</p>}
          {error && <p style={{ color: 'var(--orange)', marginTop: '8px' }}>{error}</p>}
          {/* Simulations run without logging in, but only get saved to
              history if the user was logged in at the time — see
              backend/app/routers/simulations.py's run_custom_simulation */}
          {!user && simulationResults && (
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
              Log in to save this result to your history.
            </p>
          )}
        </section>

        {/* Every result is real model output now (see backend/app/ml/registry.py) */}
        <Results data={simulationResults} />
        <AdvancedStats metrics={simulationStats} selectedModel={ACTIVE_MODEL} />
      </main>
    </>
  );
}
