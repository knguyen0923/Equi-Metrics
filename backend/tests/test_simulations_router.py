"""HTTP-level tests for every /simulations/* endpoint
(app/routers/simulations.py) — building a custom race, browsing/reading
history, and the read-only stats/lookup endpoints.

Real horse profile ids are pulled from app.ml.registry directly rather than
hardcoded, so these tests don't silently rot if the underlying data file
(app/ml/data/test_races.csv) is ever regenerated.
"""

from app.ml import registry
from tests.test_auth import signup


def _signup_and_get_token(client, email="rider@example.com"):
    # Reuses test_auth.py's signup() rather than re-posting the same
    # payload shape here, so there's one place that knows what a signup
    # request looks like.
    return signup(client, email=email).json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _real_custom_race_payload():
    options = registry.get_race_context_options()
    course = options["courses"][0]
    horses = registry.search_horses(search="", limit=3)
    return {
        "course": course,
        "going": options["goings"][0],
        "race_class": options["classes"][0],
        # Must be the region that actually corresponds to `course` — see
        # registry._COURSE_TO_REGION.
        "region": options["courseRegions"][course],
        "surface": options["surfaces"][0],
        "distance_category": options["distanceCategories"][0],
        "profile_ids": [h["profileId"] for h in horses],
    }


# --- Read-only lookup endpoints -----------------------------------------


def test_get_stats_returns_all_four_evaluated_models(client):
    response = client.get("/simulations/stats")
    assert response.status_code == 200
    models = {row["model"] for row in response.json()}
    assert models == {"XGBRanker", "CatBoost Ranker", "LightGBM Ranker", "Neural Network Ranker"}


def test_get_race_context_options_has_the_expected_shape(client):
    response = client.get("/simulations/race-context-options")
    assert response.status_code == 200
    body = response.json()
    for key in ["courses", "goings", "classes", "regions", "surfaces", "distanceCategories", "courseRegions"]:
        assert key in body
        assert len(body[key]) > 0


def test_get_horses_search_returns_matches(client):
    response = client.get("/simulations/horses", params={"search": "zephyr"})
    assert response.status_code == 200
    horses = response.json()
    assert len(horses) > 0
    assert all("zephyr" in h["horse"].lower() for h in horses)


def test_get_horses_populate_random_and_class_filter(client):
    # Backs the frontend's "Populate Random"/"Populate Class 1" buttons.
    random_response = client.get("/simulations/horses", params={"random": "true", "limit": 10})
    assert random_response.status_code == 200
    assert 0 < len(random_response.json()) <= 10

    class_response = client.get(
        "/simulations/horses", params={"race_class": "Class 1", "random": "true", "limit": 10}
    )
    assert class_response.status_code == 200
    assert len(class_response.json()) > 0


# --- Running a custom race ----------------------------------------------


def test_custom_run_returns_real_ranked_results(client):
    response = client.post("/simulations/custom-run", json=_real_custom_race_payload())
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 3
    assert body["isPlaceholder"] is False


def test_custom_run_anonymously_is_not_saved(client):
    response = client.post("/simulations/custom-run", json=_real_custom_race_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["saved"] is False
    assert body["id"] is None


def test_custom_run_while_logged_in_is_saved_with_a_custom_marked_course(client):
    token = _signup_and_get_token(client)
    payload = _real_custom_race_payload()
    response = client.post("/simulations/custom-run", json=payload, headers=_auth_headers(token))
    assert response.status_code == 200
    assert response.json()["saved"] is True

    history = client.get("/simulations/history", headers=_auth_headers(token)).json()
    # "(custom)" suffix (see routers/simulations.py) is what lets a user
    # tell a custom-built race apart from a real historical one at a glance.
    assert "(custom)" in history[0]["track"]


def test_custom_run_rejects_fewer_than_three_horses(client):
    payload = _real_custom_race_payload()
    payload["profile_ids"] = payload["profile_ids"][:2]
    response = client.post("/simulations/custom-run", json=payload)
    assert response.status_code == 400


def test_custom_run_rejects_an_absurdly_large_field(client):
    # No real race fields this many runners — this is a schema-level cap
    # (422, before registry.predict_custom even runs) against an anonymous
    # caller forcing the server to rank an unreasonably large field.
    payload = _real_custom_race_payload()
    payload["profile_ids"] = list(range(41))
    response = client.post("/simulations/custom-run", json=payload)
    assert response.status_code == 422


# --- History -------------------------------------------------------------


def test_history_requires_login(client):
    response = client.get("/simulations/history")
    assert response.status_code == 401


def test_history_only_shows_the_calling_users_own_simulations(client):
    token_a = _signup_and_get_token(client, email="rider-a@example.com")
    token_b = _signup_and_get_token(client, email="rider-b@example.com")

    client.post("/simulations/custom-run", json=_real_custom_race_payload(), headers=_auth_headers(token_a))

    history_a = client.get("/simulations/history", headers=_auth_headers(token_a)).json()
    history_b = client.get("/simulations/history", headers=_auth_headers(token_b)).json()

    assert len(history_a) == 1
    assert len(history_b) == 0


def test_history_detail_returns_the_full_results_breakdown(client):
    token = _signup_and_get_token(client)
    run_response = client.post(
        "/simulations/custom-run", json=_real_custom_race_payload(), headers=_auth_headers(token)
    )
    sim_id = run_response.json()["id"]

    detail = client.get(f"/simulations/history/{sim_id}", headers=_auth_headers(token))
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == sim_id
    assert len(body["results"]) == 3


def test_history_detail_is_not_visible_to_a_different_user(client):
    token_a = _signup_and_get_token(client, email="rider-a@example.com")
    token_b = _signup_and_get_token(client, email="rider-b@example.com")

    run_response = client.post(
        "/simulations/custom-run", json=_real_custom_race_payload(), headers=_auth_headers(token_a)
    )
    sim_id = run_response.json()["id"]

    # Same id, wrong owner — must 404, not leak rider A's data to rider B.
    response = client.get(f"/simulations/history/{sim_id}", headers=_auth_headers(token_b))
    assert response.status_code == 404


def test_history_detail_rejects_a_malformed_id(client):
    token = _signup_and_get_token(client)
    response = client.get("/simulations/history/not-a-valid-object-id", headers=_auth_headers(token))
    assert response.status_code == 400


def test_history_detail_requires_login(client):
    response = client.get("/simulations/history/000000000000000000000000")
    assert response.status_code == 401
