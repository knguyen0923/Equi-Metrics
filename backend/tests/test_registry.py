"""Unit tests for app/ml/registry.py — the real XGBRanker inference layer.

These call the registry module directly (no HTTP, no FastAPI) since the
interesting behavior — feature encoding, race-relative rank recomputation,
error handling — lives entirely in plain functions. Uses the real model
and the real trimmed test-races CSV (app/ml/data/), not a mock, since the
whole point of this module is to prove the actual encoding pipeline works
against actual data — see the module's own docstring for how that data
was derived and validated (~71% top-1 accuracy on a 100-race sample).
"""

import pytest

from app.ml import registry


def test_count_races_is_positive_and_matches_the_known_test_set_size():
    # 1,770 is the exact number of held-out test races produced by
    # scripts/build_ml_data.py at the time this suite was written. If the
    # underlying data file changes, this is meant to catch that — update
    # the expected number deliberately, don't just bump it to make it pass.
    assert registry.count_races() == 1770


def test_list_races_search_only_returns_matching_courses():
    results = registry.list_races(search="redcar", limit=50)
    assert len(results) > 0
    assert all("redcar" in r["course"].lower() for r in results)


def test_list_races_respects_limit_and_skip():
    page_one = registry.list_races(limit=5, skip=0)
    page_two = registry.list_races(limit=5, skip=5)
    assert len(page_one) == 5
    assert len(page_two) == 5
    # Paginated, not overlapping.
    assert {r["raceKey"] for r in page_one}.isdisjoint({r["raceKey"] for r in page_two})


def test_predict_returns_three_horses_ranked_with_sane_values():
    race_key = registry.list_races(limit=1)[0]["raceKey"]
    results = registry.predict(race_key)

    assert len(results) == 3
    assert [r.rank for r in results] == [1, 2, 3]
    for horse in results:
        assert horse.model == "XGBRanker"
        assert 0 <= horse.probability <= 100
        assert horse.horse  # non-empty real horse name, not a placeholder


def test_predict_raises_for_an_unknown_race_key():
    with pytest.raises(ValueError):
        registry.predict("this-race-key-does-not-exist")


def test_get_race_course_matches_what_list_races_reported():
    race = registry.list_races(limit=1)[0]
    assert registry.get_race_course(race["raceKey"]) == race["course"]


def test_get_race_course_raises_for_an_unknown_race_key():
    with pytest.raises(ValueError):
        registry.get_race_course("this-race-key-does-not-exist")


def test_search_horses_returns_matching_names_with_usable_profile_ids():
    results = registry.search_horses(search="zephyr", limit=10)
    assert len(results) > 0
    assert all("zephyr" in h["horse"].lower() for h in results)
    assert all(isinstance(h["profileId"], int) for h in results)


def test_get_race_context_options_excludes_the_unclassified_placeholder_class():
    options = registry.get_race_context_options()
    # "0" means "unclassified" in the source data, not a real class a user
    # would deliberately pick for a custom race (see registry.py).
    assert "0" not in options["classes"]
    assert "Class 1" in options["classes"]
    assert len(options["courses"]) > 0
    assert len(options["surfaces"]) > 0


def _sample_context():
    options = registry.get_race_context_options()
    return {
        "course": options["courses"][0],
        "going": options["goings"][0],
        "race_class": options["classes"][0],
        "region": options["regions"][0],
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
