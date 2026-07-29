// Style constants shared by RealRaceSetup and CustomRaceSetup — the two
// search dropdowns (race, horse) and their "ghost" action buttons
// (Change/Remove) look identical, so the styles live here once instead of
// being duplicated across both components.
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
};

// Muted, smaller secondary text next to a course/horse name — the race
// date, a horse's last-seen course, its jockey.
export const mutedSmallText = { fontSize: "0.75em", color: "var(--text-muted)" };

// A borderless, inline "ghost" action button — "Change" on the selected
// race, "Remove" on a selected horse.
export const ghostButtonStyle = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-muted)",
};
