"""Real XGBRanker inference over held-out historical races.

The model was trained in Equi_Metrics.ipynb on real race data (see
scripts/build_ml_data.py for how app/ml/data/test_races.csv was derived —
it's the chronological last-20% of races, the same split the notebook used
to *evaluate* the model, so nothing here was trained on these races).

Users pick one of these real historical races instead of typing in
arbitrary course/condition combos, since the model needs a real field of
runners (jockey, trainer, ratings, odds, etc.) to rank — there's no live
race-card data source wired up, so future/hypothetical races aren't
supported yet.

Encoding note: the model expects one-hot columns matching its training-time
category set exactly (see xgbranker_feature_columns.json). A handful of
raw categories in this data don't appear in that set (e.g. the "ARG" race
region, a couple of rare courses) — those just reindex to all-zero rather
than erroring, which degrades gracefully rather than crashing. Validated at
~71% top-1 accuracy on a 100-race sample, in line with the notebook's own
reported 64.8%. _log_unmapped_categories() below logs exactly which raw
courses/elo-buckets fall into this gap, so it's visible rather than only
showing up as a subtly-off prediction.
"""

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from app.models.simulation import HorseResult

DATA_DIR = Path(__file__).parent / "data"

_model = xgb.XGBRanker()
_model.load_model(str(DATA_DIR / "final_xgbranker.json"))

_FEATURE_COLUMNS = json.loads((DATA_DIR / "xgbranker_feature_columns.json").read_text())
_FEATURE_COLUMNS_SET = set(_FEATURE_COLUMNS)

_RACES_DF = pd.read_csv(DATA_DIR / "test_races.csv", low_memory=False)

_CATEGORICAL_COLS = [
    "race_region", "race_course", "race_class", "race_going",
    "distance_category", "elo_bucket", "pedigree_quartile",
    "race_surface", "runner_sex", "runner_headgear",
]

_COURSE_RE = re.compile(r"^(.*?)\s*\(([A-Za-z]+)\)$")


def _transform_course(name: str) -> str:
    # Training's course columns drop the "(GB)" suffix for GB courses (the
    # implicit default) but keep it for everything else, e.g. "Redcar" vs
    # "CompiegneFR" — see scripts/build_ml_data.py for how this was verified.
    match = _COURSE_RE.match(str(name).strip())
    if not match:
        return re.sub(r"[^A-Za-z0-9]", "", str(name).strip())
    base, country_code = match.group(1), match.group(2).upper()
    base = re.sub(r"[^A-Za-z0-9]", "", base)
    return base if country_code == "GB" else base + country_code


def _transform_elo_bucket(raw: str) -> str:
    # Raw values are pandas interval strings like "(1400, 1500]"; training's
    # columns are named e.g. "elo_bucket_14001500".
    numbers = re.findall(r"\d+", str(raw))
    return "".join(numbers) if len(numbers) == 2 else ""


def _log_unmapped_categories() -> None:
    # _transform_course/_transform_elo_bucket guess the training-time column
    # name from a regex rather than a verified raw->encoded mapping, so a
    # raw value that doesn't actually match a known feature column silently
    # reindexes to all-zero in _build_features (no course/elo signal at all
    # for that row) instead of erroring. Printed once at startup so that
    # gap is visible in logs rather than only showing up as an unexplained
    # dip in prediction quality for certain courses.
    unmapped_courses = sorted(
        {
            raw
            for raw in _RACES_DF["race_course"].dropna().unique()
            if f"race_course_{_transform_course(raw)}" not in _FEATURE_COLUMNS_SET
        }
    )
    if unmapped_courses:
        print(f"[ml.registry] {len(unmapped_courses)} course(s) have no matching training feature "
              f"(will rank with no course signal): {unmapped_courses}")

    unmapped_buckets = sorted(
        {
            raw
            for raw in _RACES_DF["elo_bucket"].dropna().unique()
            if f"elo_bucket_{_transform_elo_bucket(raw)}" not in _FEATURE_COLUMNS_SET
        }
    )
    if unmapped_buckets:
        print(f"[ml.registry] {len(unmapped_buckets)} elo bucket(s) have no matching training feature: "
              f"{unmapped_buckets}")


_log_unmapped_categories()


def _build_features(race_df: pd.DataFrame) -> pd.DataFrame:
    df = race_df.copy()
    df["race_course"] = df["race_course"].apply(_transform_course)
    df["race_going"] = df["race_going"].astype(str).str.replace(" ", "", regex=False)
    df["race_class"] = df["race_class"].astype(str).str.replace(" ", "", regex=False)
    df["elo_bucket"] = df["elo_bucket"].apply(_transform_elo_bucket)

    encoded = pd.get_dummies(df, columns=_CATEGORICAL_COLS)
    return encoded.reindex(columns=_FEATURE_COLUMNS, fill_value=0).astype("float32")


def _decimal_to_fractional(decimal_odds: float) -> str:
    # runner_sp_dec is the real historical starting price, e.g. 5.5 -> "9-2".
    fraction = max(decimal_odds - 1, 0.5)
    half_steps = round(fraction * 2) / 2
    if half_steps == int(half_steps):
        return f"{int(half_steps)}-1"
    return f"{int(half_steps * 2)}-2"


def _results_from_scores(race_df: pd.DataFrame, scores: np.ndarray) -> list[HorseResult]:
    exp_scores = np.exp(scores - np.max(scores))
    win_probabilities = exp_scores / exp_scores.sum()

    order = np.argsort(-scores)[:3]

    results = []
    for rank, idx in enumerate(order, start=1):
        row = race_df.iloc[idx]
        odds = _decimal_to_fractional(row["runner_sp_dec"]) if pd.notna(row["runner_sp_dec"]) else "—"
        results.append(
            HorseResult(
                rank=rank,
                horse=row["runner_horse"],
                predictedRank=rank,
                probability=int(round(win_probabilities[idx] * 100)),
                odds=odds,
                model="XGBRanker",
            )
        )
    return results


def _score_and_rank(race_df: pd.DataFrame) -> list[HorseResult]:
    # Shared tail end of predict() and predict_custom(): encode, score,
    # rank — the only difference between the two is how race_df is built.
    X = _build_features(race_df)
    scores = _model.predict(X)
    return _results_from_scores(race_df, scores)


def _sorted_unique(series: pd.Series, exclude: set | None = None) -> list:
    values = series.dropna().unique().tolist()
    if exclude:
        values = [v for v in values if v not in exclude]
    return sorted(values)


# Precomputed once at module load, not per-request — _RACES_DF never
# changes at runtime, so list_races/search_horses/get_race_context_options
# used to redo this same sort/dedup/unique work (over up to ~16k rows) on
# every single call for no reason.
_RACE_INDEX = (
    _RACES_DF[["race_key", "race_course", "race_date"]]
    .drop_duplicates("race_key")
    .sort_values("race_date", ascending=False)
)

_LATEST_HORSE_PROFILES = _RACES_DF.sort_values("race_date").drop_duplicates("runner_horse", keep="last")

_RACE_CONTEXT_OPTIONS = {
    "courses": _sorted_unique(_RACES_DF["race_course"]),
    "goings": _sorted_unique(_RACES_DF["race_going"]),
    # "0" is an "unclassified" placeholder in the source data, not a real
    # class a user would pick.
    "classes": _sorted_unique(_RACES_DF["race_class"], exclude={"0"}),
    "regions": _sorted_unique(_RACES_DF["race_region"]),
    "surfaces": _sorted_unique(_RACES_DF["race_surface"]),
    "distanceCategories": _sorted_unique(_RACES_DF["distance_category"]),
}


def list_races(search: str = "", limit: int = 20, skip: int = 0) -> list[dict]:
    races = _RACE_INDEX
    if search:
        races = races[races["race_course"].str.contains(search, case=False, na=False)]
    page = races.iloc[skip: skip + limit]
    return [
        {"raceKey": row.race_key, "course": row.race_course, "date": row.race_date}
        for row in page.itertuples()
    ]


def count_races() -> int:
    return int(_RACES_DF["race_key"].nunique())


def get_race_course(race_key: str) -> str:
    match = _RACES_DF.loc[_RACES_DF["race_key"] == race_key, "race_course"]
    if match.empty:
        raise ValueError(f"Unknown race_key: {race_key}")
    return match.iloc[0]


def predict(race_key: str) -> list[HorseResult]:
    race_df = _RACES_DF[_RACES_DF["race_key"] == race_key].reset_index(drop=True)
    if race_df.empty:
        raise ValueError(f"Unknown race_key: {race_key}")
    return _score_and_rank(race_df)


# --- Custom race builder -----------------------------------------------
#
# Lets a user assemble a hypothetical race from real horses (each seeded
# from their own most recent real feature row — age, ratings, sire/dam
# stats, elo, etc.) placed into a race context (course/going/class/etc.)
# the user picks freely. Race-*relative* features (or_rank, rpr_rank,
# tsr_rank, elo_rank, horse_elo_vs_race_avg, elo_bucket) only make sense
# for a specific field of runners, so they're recomputed here against the
# assembled field rather than reused from each horse's original race.

_ELO_BUCKET_EDGES = [0, 1300, 1400, 1500, 1600, 1700, 2500]

_DISTANCE_METERS_BY_CATEGORY = (
    _RACES_DF.groupby("distance_category")["race_dist_meters"].median().to_dict()
)


def get_race_context_options() -> dict:
    return _RACE_CONTEXT_OPTIONS


def search_horses(search: str = "", limit: int = 20) -> list[dict]:
    # One profile per horse: their most recent real appearance, used to
    # seed age/ratings/jockey/etc. defaults for the custom race.
    latest = _LATEST_HORSE_PROFILES
    if search:
        latest = latest[latest["runner_horse"].str.contains(search, case=False, na=False)]
    latest = latest.sort_values("runner_horse").head(limit)

    return [
        {
            "profileId": int(idx),
            "horse": row.runner_horse,
            "lastCourse": row.race_course,
            "lastDate": row.race_date,
            "age": None if pd.isna(row.runner_age) else float(row.runner_age),
            "jockey": row.runner_jockey,
            "trainer": row.runner_trainer,
            "officialRating": None if row.runner_or == -1 else float(row.runner_or),
        }
        for idx, row in latest.iterrows()
    ]


def predict_custom(context: dict, profile_ids: list[int]) -> list[HorseResult]:
    if len(profile_ids) < 3:
        raise ValueError("Select at least 3 horses")
    if len(set(profile_ids)) != len(profile_ids):
        raise ValueError("The same horse was selected twice")

    try:
        rows = _RACES_DF.loc[profile_ids].copy()
    except KeyError:
        raise ValueError("Unknown horse profile id") from None

    rows["race_course"] = context["course"]
    rows["race_going"] = context["going"]
    rows["race_class"] = context["race_class"]
    rows["race_region"] = context["region"]
    rows["race_surface"] = context["surface"]
    rows["distance_category"] = context["distance_category"]
    rows["race_dist_meters"] = _DISTANCE_METERS_BY_CATEGORY.get(
        context["distance_category"], rows["race_dist_meters"].median()
    )

    # Recompute this field's race-relative features — see module docstring.
    rows["or_rank"] = rows["runner_or"].rank(ascending=False, method="average")
    rows["rpr_rank"] = rows["runner_rpr"].rank(ascending=False, method="average")
    rows["tsr_rank"] = rows["runner_tsr"].rank(ascending=False, method="average")
    rows["elo_rank"] = rows["horse_elo_before"].rank(ascending=False, method="average")
    rows["horse_elo_vs_race_avg"] = rows["horse_elo_before"] - rows["horse_elo_before"].mean()
    rows["elo_bucket"] = pd.cut(rows["horse_elo_before"], bins=_ELO_BUCKET_EDGES).astype(str)

    rows = rows.reset_index(drop=True)
    return _score_and_rank(rows)
