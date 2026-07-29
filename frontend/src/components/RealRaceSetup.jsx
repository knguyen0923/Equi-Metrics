import { dropdownStyle, dropdownItemStyle, mutedSmallText, ghostButtonStyle } from "./setupStyles";

// Search-and-select UI for running the model against a real historical
// race (see SimulationSetup.jsx's module comment for why arbitrary/
// hypothetical races aren't supported this way — that's what
// CustomRaceSetup is for instead).
export default function RealRaceSetup({
  activeModel,
  searchTerm,
  onSearchTermChange,
  selectedRace,
  onSelectRace,
  onClearRace,
  raceOptions,
  isSimulating,
  onRunSimulation,
}) {
  return (
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
          <button type="button" onClick={onClearRace} aria-label="Change race" style={ghostButtonStyle}>
            Change
          </button>
        </div>
      ) : (
        <input
          placeholder="Search race by course..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      )}

      {!selectedRace && raceOptions.length > 0 && (
        <ul style={dropdownStyle}>
          {raceOptions.map((race) => (
            <li key={race.raceKey}>
              <button type="button" onClick={() => onSelectRace(race)} style={dropdownItemStyle}>
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
      <select value={activeModel} disabled title="Only XGBRanker is available right now">
        <option value="XGBRanker">XGBRanker</option>
        <option value="CatBoost Ranker">CatBoost Ranker (Coming soon)</option>
        <option value="LightGBM Ranker">LightGBM Ranker (Coming soon)</option>
        <option value="Neural Network Ranker">Neural Network Ranker (Coming soon)</option>
      </select>

      {/* Disabled until a real race has been picked from the search results */}
      <button onClick={onRunSimulation} disabled={isSimulating || !selectedRace}>
        {isSimulating ? "Running..." : "Run Simulation"}
      </button>
    </div>
  );
}
