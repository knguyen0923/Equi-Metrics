import { dropdownStyle, dropdownItemStyle, mutedSmallText, ghostButtonStyle } from "./setupStyles";

const CONTEXT_FIELDS = [
  { key: "course", label: "Course", options: "courses" },
  { key: "going", label: "Going", options: "goings" },
  { key: "race_class", label: "Class", options: "classes" },
  { key: "region", label: "Region", options: "regions" },
  { key: "surface", label: "Surface", options: "surfaces" },
  { key: "distance_category", label: "Distance", options: "distanceCategories" },
];

// Lets a user assemble a hypothetical race from real horses placed into a
// race context (course/going/class/etc.) they pick freely — see
// SimulationSetup.jsx's module comment and backend/app/ml/registry.py's
// "Custom race builder" section for how each horse's ratings/history seed
// the model and how race-relative features get recomputed for this field.
export default function CustomRaceSetup({
  contextOptions,
  context,
  onContextChange,
  horseSearchTerm,
  onHorseSearchTermChange,
  horseOptions,
  onAddHorse,
  selectedHorses,
  onRemoveHorse,
  canRunCustom,
  isSimulating,
  onRunCustomSimulation,
}) {
  return (
    <div>
      <div className="form-grid">
        {CONTEXT_FIELDS.map(({ key, label, options }) => (
          <select key={key} value={context[key]} onChange={(e) => onContextChange(key, e.target.value)}>
            <option value="">{label}</option>
            {contextOptions?.[options].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        ))}
      </div>

      <div style={{ position: "relative", marginTop: "16px" }}>
        <input
          placeholder="Search horses by name to add to the field..."
          value={horseSearchTerm}
          onChange={(e) => onHorseSearchTermChange(e.target.value)}
        />

        {horseOptions.length > 0 && (
          <ul style={dropdownStyle}>
            {horseOptions.map((horse) => (
              <li key={horse.profileId}>
                <button type="button" onClick={() => onAddHorse(horse)} style={dropdownItemStyle}>
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
              <span style={mutedSmallText}>{horse.jockey ? `Jockey: ${horse.jockey}` : ""}</span>
              <button
                type="button"
                onClick={() => onRemoveHorse(horse.profileId)}
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

      <button onClick={onRunCustomSimulation} disabled={isSimulating || !canRunCustom} style={{ marginTop: "12px" }}>
        {isSimulating ? "Running..." : "Run Simulation"}
      </button>
    </div>
  );
}
