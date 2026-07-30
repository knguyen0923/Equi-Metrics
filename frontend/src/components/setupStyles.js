// Style constants for CustomRaceSetup's horse-search dropdown and its
// "ghost" action buttons (Remove) — kept separate from inline styles so
// they don't get duplicated if another search dropdown is added later.
export const dropdownStyle = {
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

export const dropdownItemStyle = {
  width: "100%",
  textAlign: "left",
  padding: "8px 12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  // <button> doesn't inherit the page's light `color` from a dark
  // background the way plain text does — without this, browsers render it
  // in their default (dark) button text color, which is nearly invisible
  // against this dropdown's dark background (this is what made the horse
  // names in the search results unreadable).
  color: "var(--text-main)",
  fontSize: "1em",
};

// Muted, smaller secondary text next to a course/horse name — the race
// date, a horse's last-seen course, its jockey.
export const mutedSmallText = { fontSize: "0.75em", color: "var(--text-muted)" };

// A borderless, inline "ghost" action button — "Remove" on a selected horse.
export const ghostButtonStyle = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-muted)",
};

// A bordered, secondary-emphasis action button — the "Populate Random"/
// "Populate Class 1" quick-fill buttons next to the horse search bar.
// Deliberately not the bright orange .form-grid button style, since these
// are convenience shortcuts, not the primary "Run Simulation" action.
export const secondaryButtonStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  color: "var(--text-main)",
  padding: "0 18px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};
