"""Real XGBRanker inference over a custom-built field of horses.

The model was trained in Equi_Metrics.ipynb on real race data (see
scripts/build_ml_data.py for how app/ml/data/test_races.csv was derived —
it's the chronological last-20% of races, the same split the notebook used
to *evaluate* the model, so nothing here was trained on these races).

Users assemble a hypothetical race from real horses (each seeded from their
own most recent real appearance — jockey, trainer, ratings, odds, etc.)
placed into a race context they pick freely, rather than choosing one of
these historical races verbatim — see the "Custom race builder" section
below for how that works and how race-relative features get recomputed for
the assembled field.

Encoding note: the model expects one-hot columns matching its training-time
category set exactly (see xgbranker_feature_columns.json). A handful of raw
categories in this data don't appear in that set — those just reindex to
all-zero rather than erroring, which degrades gracefully rather than
crashing. Validated at ~71% top-1 accuracy on a 100-race sample, in line
with the notebook's own reported 64.8%.

Most of that gap isn't actually a gap: training one-hot-encoded with
pd.get_dummies(drop_first=True), which drops the alphabetically-first raw
value of *every* categorical column as an implicit reference category
(e.g. "Abu Dhabi (UAE)" for race_course) — an all-zero row for that column
is the *correct* encoding for it, not missing signal. known_categories.json
(see scripts/build_ml_data.py) records the full raw vocabulary training
actually saw, so _log_unmapped_categories() below checks every categorical
column and can tell that expected, single-dropped-baseline-per-column case
apart from a raw value that's neither mapped nor the dropped baseline — a
real gap, e.g. from a transform guessing the training-time format wrong
(this is exactly how a missing "e/s" -> "es" cleanup on runner_headgear was
caught and fixed).
"""

import json
import logging
import re
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from app.models.simulation import HorseResult

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"

_model = xgb.XGBRanker()
_model.load_model(str(DATA_DIR / "final_xgbranker.json"))

_FEATURE_COLUMNS = json.loads((DATA_DIR / "xgbranker_feature_columns.json").read_text())
_FEATURE_COLUMNS_SET = set(_FEATURE_COLUMNS)
_KNOWN_CATEGORIES = json.loads((DATA_DIR / "known_categories.json").read_text())

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


def _strip_non_alnum(value) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value))


# One transform per categorical column, mirroring exactly what a raw value
# turns into before pd.get_dummies at training time — used both by
# _build_features below (for the 5 columns that actually need cleanup) and,
# read-only, by _log_uncovered_raw_values (for every column, to know what
# feature-column name to look for without touching real encoding behavior).
_CATEGORICAL_TRANSFORMS = {
    "race_region": str,
    "race_course": _transform_course,
    "race_class": lambda v: str(v).replace(" ", ""),
    "race_going": lambda v: str(v).replace(" ", ""),
    "distance_category": str,
    "elo_bucket": _transform_elo_bucket,
    "pedigree_quartile": str,
    "race_surface": str,
    "runner_sex": str,
    # Raw values like "e/s" need the slash stripped to match training's
    # column-name cleanup (see module docstring) — previously left
    # untransformed, so those rows silently lost headgear signal without
    # even being logged (only race_course/elo_bucket were checked before).
    "runner_headgear": _strip_non_alnum,
}


def _log_uncovered_raw_values(column: str, transform) -> None:
    # A raw value with no matching feature column falls into one of two
    # very different buckets:
    #   - it's the alphabetically-first raw value for this column: that's
    #     exactly the category training's pd.get_dummies(drop_first=True)
    #     drops as the implicit reference, so an all-zero encoding is
    #     *correct*, not a gap (see module docstring).
    #   - anything else: it's not the dropped baseline, so a missing feature
    #     column means either it's genuinely new data or `transform` guessed
    #     the training-time format wrong — a real signal-loss gap either way.
    known = _KNOWN_CATEGORIES.get(column, [])
    dropped_baseline_value = min(known) if known else None

    dropped_baseline = []
    genuinely_unseen = []
    for raw in sorted(_RACES_DF[column].dropna().unique()):
        if f"{column}_{transform(raw)}" in _FEATURE_COLUMNS_SET:
            continue
        (dropped_baseline if str(raw) == dropped_baseline_value else genuinely_unseen).append(raw)

    if dropped_baseline:
        logger.info(
            "%d %s value(s) are training's dropped baseline category "
            "(expected — encodes as all-zero by design, not a gap): %s",
            len(dropped_baseline), column, dropped_baseline,
        )
    if genuinely_unseen:
        logger.warning(
            "%d %s value(s) never appeared in training data (will rank with no %s signal): %s",
            len(genuinely_unseen), column, column, genuinely_unseen,
        )


def _log_unmapped_categories() -> None:
    for column, transform in _CATEGORICAL_TRANSFORMS.items():
        _log_uncovered_raw_values(column, transform)


_log_unmapped_categories()

# Columns that actually need their raw value rewritten before pd.get_dummies
# to match training's format. The rest (race_region, distance_category,
# pedigree_quartile, race_surface, runner_sex) go in untouched, same as
# before — applying str() to them here would turn real NaNs into the
# literal string "nan" and change how they're one-hot encoded.
_TRANSFORMED_COLS = ("race_course", "race_class", "race_going", "elo_bucket", "runner_headgear")


def _build_features(race_df: pd.DataFrame) -> pd.DataFrame:
    df = race_df.copy()
    for column in _TRANSFORMED_COLS:
        df[column] = df[column].apply(_CATEGORICAL_TRANSFORMS[column])

    encoded = pd.get_dummies(df, columns=_CATEGORICAL_COLS)
    return encoded.reindex(columns=_FEATURE_COLUMNS, fill_value=0).astype("float32")


def _decimal_to_fractional(decimal_odds: float) -> str:
    # runner_sp_dec is the real historical starting price, e.g. 5.5 -> "9-2".
    # Quarter-point resolution (1/4, 1/2, 3/4, 1/1, ...) instead of the
    # previous half-point-only scheme, which floored every price shorter
    # than 1/2 (decimal 1.5) to the same "1-2" regardless of how much
    # shorter the true price actually was — a 1.05 and a 1.45 favorite
    # both displayed identically.
    fraction = max(decimal_odds - 1, 0.0)
    quarters = round(fraction * 4)
    if quarters == 0:
        return "1-10"  # shorter than 1/4 — not modeling a finer ladder than that
    if quarters % 4 == 0:
        return f"{quarters // 4}-1"
    if quarters % 2 == 0:
        return f"{quarters // 2}-2"
    return f"{quarters}-4"


def _results_from_scores(race_df: pd.DataFrame, scores: np.ndarray) -> list[HorseResult]:
    exp_scores = np.exp(scores - np.max(scores))
    win_probabilities = exp_scores / exp_scores.sum()

    order = np.argsort(-scores)[:3]

    results = []
    for rank, idx in enumerate(order, start=1):
        row = race_df.iloc[idx]
        # 0.0 is this data's sentinel for "no recorded starting price" (a
        # real decimal price is always > 1.0) — pd.notna(0.0) is True, so
        # without the extra check a missing price rendered as a fabricated
        # "1-10" near-favorite instead of "—".
        sp_dec = row["runner_sp_dec"]
        odds = _decimal_to_fractional(sp_dec) if pd.notna(sp_dec) and sp_dec > 0 else "—"
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
# changes at runtime, so search_horses/get_race_context_options used to redo
# this same sort/dedup/unique work (over up to ~16k rows) on every single
# call for no reason.
_LATEST_HORSE_PROFILES = _RACES_DF.sort_values("race_date").drop_duplicates("runner_horse", keep="last")

# Each course only ever appears in one region in real life (a course doesn't
# move countries), but a handful of rows have inconsistent/dirty
# race_region values for the same race_course — mode() rather than the
# first-seen value picks whichever region that course's rows overwhelmingly
# agree on, so a data glitch in one row can't flip the whole course's mapping.
_COURSE_TO_REGION = (
    _RACES_DF.groupby("race_course")["race_region"]
    .agg(lambda regions: regions.mode().iloc[0])
    .to_dict()
)

_RACE_CONTEXT_OPTIONS = {
    "courses": _sorted_unique(_RACES_DF["race_course"]),
    "goings": _sorted_unique(_RACES_DF["race_going"]),
    # "0" is an "unclassified" placeholder in the source data, not a real
    # class a user would pick.
    "classes": _sorted_unique(_RACES_DF["race_class"], exclude={"0"}),
    "regions": _sorted_unique(_RACES_DF["race_region"]),
    "surfaces": _sorted_unique(_RACES_DF["race_surface"]),
    "distanceCategories": _sorted_unique(_RACES_DF["distance_category"]),
    # Lets the frontend auto-fill/lock the region once a course is picked,
    # instead of letting the two be set independently to a combination that
    # never actually occurs in the data (e.g. a GB course with an ARG region).
    "courseRegions": _COURSE_TO_REGION,
}


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


def search_horses(
    search: str = "", limit: int = 20, race_class: str | None = None, random_order: bool = False
) -> list[dict]:
    # One profile per horse: their most recent real appearance, used to
    # seed age/ratings/jockey/etc. defaults for the custom race.
    latest = _LATEST_HORSE_PROFILES
    if search:
        latest = latest[latest["runner_horse"].str.contains(search, case=False, na=False)]
    if race_class:
        # Filters on the class of each horse's most-recent race (the same
        # one their profile is seeded from), not their full career history —
        # consistent with how every other profile field here (age, jockey,
        # ratings) is also only ever this one appearance's data.
        latest = latest[latest["race_class"] == race_class]

    if random_order:
        # Used by the frontend's "populate" quick-fill buttons, so repeated
        # clicks add a different batch instead of the same alphabetically-
        # first N horses every time.
        latest = latest.sample(n=min(limit, len(latest))) if len(latest) else latest
    else:
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
