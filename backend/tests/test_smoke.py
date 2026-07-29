"""Sanity check that the test harness itself (fake DB + TestClient +
lifespan) actually works, before relying on it for real test coverage.
"""


def test_health_check_does_not_touch_the_database(client):
    # /health is deliberately DB-free (see app/main.py) so it stays up even
    # if Atlas is slow/unreachable — this should pass even against the fake.
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
