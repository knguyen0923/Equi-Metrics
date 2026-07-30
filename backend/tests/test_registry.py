"""Unit tests for app/ml/registry.py — the real XGBRanker inference layer.

These call the registry module directly (no HTTP, no FastAPI) since the
interesting behavior — feature encoding, race-relative rank recomputation,
error handling — lives entirely in plain functions. Uses the real model
and the real trimmed test-races CSV (app/ml/data/), not a mock, since the
whole point of this module is to prove the actual encoding pipeline works
against actual data — see the module's own docstring for how that data
was derived and validated (~71% top-1 accuracy on a 100-race sample).
"""

import numpy as np
import pandas as pd
import pytest

from app.ml import registry


def test_search_horses_returns_matching_names_with_usable_profile_ids():
    results = registry.search_horses(search="zephyr", limit=10)
    assert len(results) > 0
    assert all("zephyr" in h["horse"].lower() for h in results)
    assert all(isinstance(h["profileId"], int) for h in results)


def test_search_horses_filters_by_race_class():
    results = registry.search_horses(limit=50, race_class="Class 1")
    assert len(results) > 0
    # HorseProfile doesn't expose race_class, so this checks against the
    # underlying data directly rather than the returned dicts.
    profile_ids = {h["profileId"] for h in results}
    assert (registry._LATEST_HORSE_PROFILES.loc[list(profile_ids), "race_class"] == "Class 1").all()


def test_search_horses_random_order_returns_distinct_horses_within_the_limit():
    results = registry.search_horses(limit=10, random_order=True)
    assert 0 < len(results) <= 10
    assert len({h["profileId"] for h in results}) == len(results)


def test_get_race_context_options_excludes_the_unclassified_placeholder_class():
    options = registry.get_race_context_options()
    # "0" means "unclassified" in the source data, not a real class a user
    # would deliberately pick for a custom race (see registry.py).
    assert "0" not in options["classes"]
    assert "Class 1" in options["classes"]
    assert len(options["courses"]) > 0
    assert len(options["surfaces"]) > 0


def test_course_regions_maps_every_course_to_one_of_the_known_regions():
    options = registry.get_race_context_options()
    assert set(options["courseRegions"]) == set(options["courses"])
    assert all(region in options["regions"] for region in options["courseRegions"].values())


def _sample_context():
    options = registry.get_race_context_options()
    course = options["courses"][0]
    return {
        "course": course,
        "going": options["goings"][0],
        "race_class": options["classes"][0],
        # Must be the region that actually corresponds to `course` — a
        # mismatched pairing never occurs in real data (see
        # registry._COURSE_TO_REGION) and would defeat the point of a test
        # meant to model a realistic custom race.
        "region": options["courseRegions"][course],
        "surface": options["surfaces"][0],
        "distance_category": options["distanceCategories"][0],
    }


def _sample_profile_ids(count=3):
    horses = registry.search_horses(search="", limit=count)
    return [h["profileId"] for h in horses]


def test_predict_custom_returns_ranked_results_for_a_real_field_of_horses():
    context = _sample_context()
    profile_ids = _sample_profile_ids(3)

    results = registry.predict_custom(context, profile_ids)

    assert len(results) == 3
    assert {r.horse for r in results}.issubset(
        {h["horse"] for h in registry.search_horses(search="", limit=3)}
    )


def test_predict_custom_requires_at_least_three_horses():
    context = _sample_context()
    with pytest.raises(ValueError):
        registry.predict_custom(context, _sample_profile_ids(2))


def test_predict_custom_rejects_the_same_horse_selected_twice():
    context = _sample_context()
    profile_id = _sample_profile_ids(1)[0]
    with pytest.raises(ValueError):
        registry.predict_custom(context, [profile_id, profile_id, profile_id])


def test_predict_custom_rejects_an_unknown_profile_id():
    context = _sample_context()
    with pytest.raises(ValueError):
        registry.predict_custom(context, [1, 2, 999_999_999])


def test_log_unmapped_categories_distinguishes_dropped_baseline_from_genuinely_unseen(caplog):
    # "Abu Dhabi (UAE)"/"(0, 1300]" have no matching feature column because
    # they're training's alphabetically-first (drop_first=True) reference
    # category for race_course/elo_bucket, not because they're unrecognized
    # — known_categories.json should let the log tell those apart instead
    # of treating every unmapped value as a signal-loss gap.
    with caplog.at_level("INFO", logger="app.ml.registry"):
        registry._log_unmapped_categories()

    assert "dropped baseline category" in caplog.text
    assert "Abu Dhabi (UAE)" in caplog.text
    assert "(0, 1300]" in caplog.text
    assert "never appeared in training data" not in caplog.text


def test_transform_headgear_strips_punctuation_to_match_training_columns():
    # "e/s" was previously left untransformed and silently reindexed to
    # all-zero — see the module docstring. Fixed by stripping non-alnum
    # characters the same way race_course's base name is cleaned.
    transform = registry._CATEGORICAL_TRANSFORMS["runner_headgear"]
    assert transform("e/s") == "es"
    assert f"runner_headgear_{transform('e/s')}" in registry._FEATURE_COLUMNS_SET


def test_log_unmapped_categories_no_longer_flags_the_fixed_headgear_value(caplog):
    with caplog.at_level("INFO", logger="app.ml.registry"):
        registry._log_unmapped_categories()
    assert "e/s" not in caplog.text


@pytest.mark.parametrize(
    "decimal_odds, expected",
    [
        (1.05, "1-10"),
        (1.25, "1-4"),
        (1.5, "1-2"),
        (1.75, "3-4"),
        (2.0, "1-1"),
        (5.5, "9-2"),
    ],
)
def test_decimal_to_fractional_quarter_point_resolution(decimal_odds, expected):
    assert registry._decimal_to_fractional(decimal_odds) == expected


def test_decimal_to_fractional_distinguishes_short_priced_favorites():
    # Previously every price under decimal 1.5 collapsed to the same "1-2"
    # — a 1.05 and a 1.45 favorite shouldn't render identically.
    assert registry._decimal_to_fractional(1.05) != registry._decimal_to_fractional(1.45)


def test_results_from_scores_shows_dash_for_a_missing_starting_price():
    # 0.0 is this dataset's sentinel for "no recorded starting price", not
    # a real decimal odds value (real prices are always > 1.0) —
    # pd.notna(0.0) is True, so this only passes if the missing-price check
    # also excludes non-positive values on purpose.
    race_df = pd.DataFrame({
        "runner_horse": ["Horse A", "Horse B", "Horse C"],
        "runner_sp_dec": [0.0, 2.5, 4.0],
    })
    scores = np.array([3.0, 2.0, 1.0])

    results = registry._results_from_scores(race_df, scores)

    assert results[0].horse == "Horse A"
    assert results[0].odds == "—"
