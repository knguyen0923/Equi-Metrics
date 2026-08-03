import Navbar from "../components/Navbar"; // Adjust import path if needed

// Every value here is real — confirmed against
// backend/app/ml/registry.py's _RACE_CONTEXT_OPTIONS, not guessed. Going and
// Distance collapse many raw values into a handful of representative
// buckets (one entry per literal "Good To Yielding"-style value would be
// unreadable); Region and Surface list every real value since both sets
// are small enough to show in full.
const FIELD_GLOSSARY = [
  {
    label: "Course",
    description: "The racetrack itself — Ascot, Compiegne, Abu Dhabi, and so on.",
  },
  {
    label: "Going",
    description:
      "How firm or soft the ground is. Dry, firm ground favors speed; soft, wet ground slows a field down and rewards stamina.",
    bullets: true,
    values: ["Firm / Fast", "Good", "Soft / Yielding", "Heavy / Muddy"],
  },
  {
    label: "Class",
    description:
      "The race's grade — Class 1 is the highest, most competitive level a horse can run in; Class 6 is the lowest.",
  },
  {
    label: "Region",
    description: "The country the race is run in — the data spans tracks across the world.",
    values: [
      "GB", "IRE", "FR", "USA", "AUS", "UAE", "HK", "JPN", "GER", "ITY",
      "SAF", "NZ", "ARG", "BRZ", "CAN", "CHI", "BHR", "JER", "PER",
    ],
  },
  {
    label: "Surface",
    description: "What the track is made of.",
    values: ["Turf", "Dirt", "AW (all-weather / synthetic)"],
  },
  {
    label: "Distance",
    // Exact thresholds from the training notebook's own bucketing rule.
    description: "How far the race is run, bucketed into four lengths.",
    values: [
      "Sprint (< 1,400 meters)",
      "Mile (1,400–1,799 meters)",
      "Medium (1,800–2,399 meters)",
      "Long (≥ 2,400 meters)",
    ],
  },
];

// Only XGBRanker was ever exported to a loadable model file (see
// backend/app/ml/registry.py's module docstring and
// frontend/src/pages/SimulationSetup.jsx's ACTIVE_MODEL) — everything else
// here is a real model that was trained and evaluated, but isn't wired into
// live predictions. Deliberately no accuracy numbers: Advanced Stats already
// shows the live figures from GET /simulations/stats, and duplicating a
// second hardcoded set here would drift from it over time.
const MODEL_INFO = [
  {
    name: "XGBoost Ranker (XGBRanker)",
    live: true,
    blurb:
      "A gradient-boosted decision tree model trained specifically to rank an entire field of horses, not just pick a winner. This is the model that actually powers every prediction on this site today.",
  },
  {
    name: "CatBoost Ranker",
    live: false,
    blurb:
      "Another gradient-boosted tree ranker, tuned differently from XGBRanker. In evaluation it was the best of all six models at ordering the full field, even though it picked the outright winner less often.",
  },
  {
    name: "LightGBM Ranker",
    live: false,
    blurb: "A third gradient-boosted tree ranker, built for speed on large datasets. It trailed the other two boosted rankers in our evaluation.",
  },
  {
    name: "Neural Network Ranker",
    live: false,
    blurb:
      "A tuned feed-forward neural network that scores each horse directly from its features rather than splitting on them like a tree. It landed between the tree-based rankers and the simpler baselines.",
  },
  {
    name: "Random Forest",
    live: false,
    blurb: "An ensemble of many decision trees voting together — a sturdier baseline than a single tree, but not built to rank a field, only to classify a winner.",
  },
  {
    name: "Decision Tree",
    live: false,
    blurb: "The simplest baseline: one tree of yes/no splits. Useful for comparison, but not rank-aware.",
  },
];

// Static marketing/info copy about the project — no data fetching, no state.
export default function About() {
  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ maxWidth: '800px', margin: '0 auto', marginTop: '40px' }}>
          <div className="section-heading">
            <p className="eyebrow">The Journey</p>
            <h2>About Equi-Metrics</h2>
          </div>

          <div style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <p>
              Equi-Metrics started as a capstone machine learning project aimed at predicting horse race
              outcomes. By aggregating global racing data via the Racing API, we engineered custom features
              including <strong>Elo ratings</strong> and complex <strong>pedigree statistics</strong> (tracking Sire, Damsire, and maternal lines).
            </p>

            <h3 style={{ color: 'var(--text-main)', marginTop: '28px' }}>New to horse racing?</h3>
            <p>
              The short version: a field of horses, each with their own jockey, runs the same course over
              the same distance at the same time — first past the post wins. Equi-Metrics doesn't just guess
              that winner; it predicts how every horse in the field is likely to finish, 1st to last, based
              on each horse's own real racing history.
            </p>

            <h3 style={{ color: 'var(--text-main)', marginTop: '28px' }}>What each field means</h3>
            <p>
              When you build a custom race, you're picking a course and conditions from six fields. Here's
              what each one actually means:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {FIELD_GLOSSARY.map(({ label, description, values, bullets }) => (
                <div
                  key={label}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                  }}
                >
                  <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 700 }}>{label}</p>
                  <p style={{ margin: '4px 0 0' }}>{description}</p>
                  {values && bullets && (
                    <ul style={{ margin: '10px 0 0', paddingLeft: '20px' }}>
                      {values.map((value) => (
                        <li key={value}>{value}</li>
                      ))}
                    </ul>
                  )}
                  {values && !bullets && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                      {values.map((value) => (
                        <span
                          key={value}
                          style={{
                            display: 'inline-flex',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '999px',
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                          }}
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <h3 style={{ color: 'var(--text-main)', marginTop: '28px' }}>The models behind the predictions</h3>
            <p>
              Our prediction engine was built by training and evaluating six different models against real,
              historical race results:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {MODEL_INFO.map(({ name, live, blurb }) => (
                <div
                  key={name}
                  style={{
                    border: `1px solid ${live ? 'var(--orange)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                  }}
                >
                  <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{name}</strong>
                    {live && <span className="race-card-tag">Live model</span>}
                  </p>
                  <p style={{ margin: '4px 0 0' }}>{blurb}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '12px' }}>
              Current accuracy figures for every model live on the <strong>Advanced Statistics</strong> table
              on the simulation page, so they never drift out of sync with what's actually running.
            </p>

            <p style={{ marginTop: '28px' }}>
              Today, Equi-Metrics lets anyone — whether you've followed racing for years or never watched a
              race — assemble a real field of horses and see its predicted finishing order, from the world's
              top thoroughbreds down to the rest of the field.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
