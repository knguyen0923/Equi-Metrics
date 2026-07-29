"""Sanity check that the test harness itself (fake DB + TestClient +
lifespan) actually works, before relying on it for real test coverage.
"""


def test_health_check_does_not_touch_the_database(client):
    # /health is deliberately DB-free (see app/main.py) so it stays up even
    # if Atlas is slow/unreachable — this should pass even against the fake.
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_every_response_carries_baseline_security_headers(client):
    response = client.get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "max-age=" in response.headers["strict-transport-security"]
    assert "default-src 'self'" in response.headers["content-security-policy"]
