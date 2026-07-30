import { useState } from "react";
import { dropdownStyle, dropdownItemStyle, mutedSmallText, ghostButtonStyle, secondaryButtonStyle } from "./setupStyles";

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
  onPopulateRandom,
  onPopulateClassOne,
  canRunCustom,
  isSimulating,
  onRunCustomSimulation,
}) {
  // Visibility used to be driven purely by "are there any results" —
  // meaning once a search had ever returned something, the dropdown had no
  // way to close short of picking a horse. This tracks focus explicitly
  // instead, so it only opens once the input actually has focus and closes
  // the moment focus leaves the whole input+dropdown group.
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div>
      <div className="form-grid">
        {CONTEXT_FIELDS.map(({ key, label, options }) => {
          let optionValues = contextOptions?.[options] ?? [];
          if (key === "course" && context.region) {
            // Narrows the course list to the selected region's courses —
            // course and region are kept in sync in both directions (see
            // SimulationSetup.jsx's handleContextChange).
            optionValues = optionValues.filter(
              (course) => contextOptions.courseRegions[course] === context.region
            );
          }
          return (
            <select key={key} value={context[key]} onChange={(e) => onContextChange(key, e.target.value)}>
              <option value="">{label}</option>
              {optionValues.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <div
          style={{ position: "relative", flex: 1 }}
          onBlur={(e) => {
            // Closes only when focus actually leaves this whole group (the
            // input or one of the dropdown's own buttons) — not when focus
            // just moves from the input to a dropdown item within it.
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setDropdownOpen(false);
            }
          }}
        >
          <input
            className="search-input"
            placeholder="Search horses by name to add to the field..."
            value={horseSearchTerm}
            onChange={(e) => onHorseSearchTermChange(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
          />

          {isDropdownOpen && horseOptions.length > 0 && (
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

        {/* Quick-fill shortcuts: add real horses without searching by name.
            "Class 1" pulls from each horse's most recent race only, same as
            every other profile field (see registry.search_horses). */}
        <button type="button" onClick={onPopulateRandom} style={secondaryButtonStyle}>
          Populate Random
        </button>
        <button type="button" onClick={onPopulateClassOne} style={secondaryButtonStyle}>
          Populate Class 1
        </button>
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
