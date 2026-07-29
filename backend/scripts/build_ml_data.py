"""One-time data prep: derive a trimmed, model-ready CSV of held-out test
races from the raw export in ml-models/, reproducing the training
notebook's chronological 80/20 train/test split so these are races the
XGBRanker model never trained on.

Run from backend/ with the venv active:
    python scripts/build_ml_data.py

Inputs (not committed to git, see ../../ml-models/):
    ml-models/new_clean_data.csv
    ml-models/xgbranker_feature_columns.json

Outputs (committed, small enough for git, loaded by app/ml/registry.py):
    app/ml/data/test_races.csv
    app/ml/data/xgbranker_feature_columns.json
    app/ml/data/known_categories.json
"""
import json
from pathlib import Path

import pandas as pd

RAW_DIR = Path(__file__).resolve().parent.parent.parent / "ml-models"
OUT_DIR = Path(__file__).resolve().parent.parent / "app" / "ml" / "data"

RAW_CSV = RAW_DIR / "clean_data.csv"
FEATURE_COLUMNS_SRC = RAW_DIR / "xgbranker_feature_columns.json"

# Columns needed either to render a race in the UI or to rebuild the 333
# model features via one-hot encoding + reindex (see registry.py). Anything
# not listed here gets dropped to keep the trimmed CSV small.
DISPLAY_COLS = [
    "runner_horse", "runner_jockey", "runner_trainer", "runner_position",
    "winner", "race_race_id", "race_date",
]

FEATURE_SOURCE_COLS = [
    "runner_age", "runner_weight_lbs", "runner_draw", "runner_or", "runner_rpr",
    "runner_tsr", "runner_sp_dec", "runner_bsp", "race_dist_meters",
    "sire_win_rate", "sire_avg_rpr", "sire_avg_tsr", "sire_sample_size",
    "damsire_win_rate", "damsire_avg_rpr", "damsire_avg_tsr", "damsire_sample_size",
    "dam_win_rate", "dam_avg_rpr", "dam_avg_tsr", "dam_sample_size",
    "pedigree_score", "horse_elo_before", "horse_elo_rank", "horse_elo_vs_race_avg",
    "or_rank", "rpr_rank", "tsr_rank", "elo_rank",
    "rpr_missing", "tsr_missing", "or_missing",
    "race_region", "race_course", "race_class", "race_going", "race_surface",
    "runner_sex", "runner_headgear",
    "distance_category", "elo_bucket", "pedigree_quartile",
]

KEEP_COLS = sorted(set(DISPLAY_COLS) | set(FEATURE_SOURCE_COLS))

# Must match app/ml/registry.py's _CATEGORICAL_COLS — the columns training
# one-hot-encoded with pd.get_dummies(drop_first=True). For each, we record
# every raw value seen anywhere in the full dataset (not just the test
# split) so registry.py can tell apart two very different situations for a
# raw value with no matching feature column: it's the alphabetically-first
# value for that column (training's dropped reference category — expected,
# not a bug) vs. it never appeared in training at all (a genuine gap).
CATEGORICAL_COLS = [
    "race_region", "race_course", "race_class", "race_going",
    "distance_category", "elo_bucket", "pedigree_quartile",
    "race_surface", "runner_sex", "runner_headgear",
]


def main():
    df = pd.read_csv(RAW_CSV, low_memory=False, usecols=lambda c: c in KEEP_COLS)
    df["race_date"] = pd.to_datetime(df["race_date"], errors="coerce")
    df["race_key"] = df["race_race_id"].astype(str) + "_" + df["race_date"].dt.strftime("%Y-%m-%d")

    # Same chronological split as the notebook: sort races by date, last 20% is test.
    race_dates = df.groupby("race_key")["race_date"].first().sort_values()
    cutoff = int(len(race_dates) * 0.80)
    test_races = set(race_dates.index[cutoff:])

    test_df = df[df["race_key"].isin(test_races)].copy()

    # Only keep races with a usable field and a real recorded winner, so
    # everything in the picker has both runners to rank and a result to
    # compare the model's pick against.
    field_sizes = test_df.groupby("race_key")["race_key"].transform("count")
    has_winner = test_df.groupby("race_key")["winner"].transform("max") == 1
    test_df = test_df[(field_sizes >= 3) & has_winner]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    test_df.to_csv(OUT_DIR / "test_races.csv", index=False)

    feature_columns = json.loads(FEATURE_COLUMNS_SRC.read_text())
    (OUT_DIR / "xgbranker_feature_columns.json").write_text(json.dumps(feature_columns))

    # Full-dataset vocabulary (train+test combined), not just the test
    # split — that's what pd.get_dummies actually saw during training.
    known_categories = {col: sorted(str(v) for v in df[col].dropna().unique()) for col in CATEGORICAL_COLS}
    (OUT_DIR / "known_categories.json").write_text(json.dumps(known_categories))

    print(f"Wrote {len(test_df)} rows across {test_df['race_key'].nunique()} test races to {OUT_DIR}")


if __name__ == "__main__":
    main()
