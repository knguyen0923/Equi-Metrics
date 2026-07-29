"""HTTP-level tests for every /auth/* endpoint (app/routers/auth.py),
covering both the success path and the security-relevant failure paths
(wrong password, reused email, expired/invalid reset token, etc.).
"""


def signup(client, email="rider@example.com", password="correcthorse123"):
    return client.post("/auth/signup", json={"email": email, "password": password})


def test_signup_returns_a_token_and_the_new_users_email(client):
    response = signup(client)
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "rider@example.com"
    assert body["access_token"]


def test_signup_lowercases_email_so_it_cant_be_used_to_dodge_the_uniqueness_check(client):
    signup(client, email="Rider@Example.com")
    duplicate = signup(client, email="rider@EXAMPLE.com")
    # Same account under different casing — must be treated as the same email.
    assert duplicate.status_code == 409


def test_signup_rejects_a_duplicate_email(client):
    signup(client, email="rider@example.com")
    duplicate = signup(client, email="rider@example.com")
    assert duplicate.status_code == 409


def test_login_succeeds_with_the_right_password(client):
    signup(client, email="rider@example.com", password="correcthorse123")
    response = client.post("/auth/login", json={"email": "rider@example.com", "password": "correcthorse123"})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_fails_with_the_wrong_password(client):
    signup(client, email="rider@example.com", password="correcthorse123")
    response = client.post("/auth/login", json={"email": "rider@example.com", "password": "wrong-password"})
    assert response.status_code == 401


def test_login_fails_for_an_email_that_was_never_registered(client):
    response = client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever123"})
    # Same 401 as a wrong password (see auth.py) — deliberately not a 404,
    # so the response can't be used to enumerate registered emails.
    assert response.status_code == 401


def test_me_requires_a_valid_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_returns_the_logged_in_users_own_email(client):
    token = signup(client, email="rider@example.com").json()["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "rider@example.com"


def test_forgot_password_gives_the_same_response_for_a_registered_and_unregistered_email(client):
    signup(client, email="rider@example.com")
    registered = client.post("/auth/forgot-password", json={"email": "rider@example.com"})
    unregistered = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})

    # Both must look identical to the caller — this is what stops the
    # endpoint being used to check which emails have accounts.
    assert registered.status_code == unregistered.status_code == 202
    assert registered.json() == unregistered.json()


def test_reset_password_with_an_invalid_token_is_rejected(client):
    response = client.post("/auth/reset-password", json={"token": "not-a-real-token", "new_password": "newpass123"})
    assert response.status_code == 400


def _prepare_known_reset_token(client, fake_db, monkeypatch, email, known_token="known-raw-token"):
    """Requests a real reset token via the API, then patches hash_reset_token
    (as used by app.routers.auth) so a *known* raw token maps to whatever
    hash actually got stored — generate_reset_token() is one-way by design
    (see app/security.py), so a test can't otherwise learn the real raw
    token that only ever goes out over email.
    """
    import app.routers.auth as auth_module
    from app import security

    client.post("/auth/forgot-password", json={"email": email})

    user_doc = next(doc for doc in fake_db["users"].docs.values() if doc["email"] == email)
    stored_hash = user_doc["reset_token_hash"]

    original_hash_fn = security.hash_reset_token
    monkeypatch.setattr(
        auth_module,
        "hash_reset_token",
        lambda raw: stored_hash if raw == known_token else original_hash_fn(raw),
    )
    return known_token


def test_reset_password_then_login_works_with_the_new_password(client, fake_db, monkeypatch):
    signup(client, email="rider@example.com", password="old-password-123")
    token = _prepare_known_reset_token(client, fake_db, monkeypatch, "rider@example.com")

    response = client.post("/auth/reset-password", json={"token": token, "new_password": "new-password-456"})
    assert response.status_code == 204

    login = client.post("/auth/login", json={"email": "rider@example.com", "password": "new-password-456"})
    assert login.status_code == 200

    old_login = client.post("/auth/login", json={"email": "rider@example.com", "password": "old-password-123"})
    assert old_login.status_code == 401


def test_reset_password_bumps_token_version_and_invalidates_old_tokens(client, fake_db, monkeypatch):
    old_token = signup(client, email="rider@example.com", password="old-password-123").json()["access_token"]
    reset_token = _prepare_known_reset_token(client, fake_db, monkeypatch, "rider@example.com")

    client.post("/auth/reset-password", json={"token": reset_token, "new_password": "new-password-456"})

    # The token issued before the reset embeds the pre-reset token_version,
    # so it must stop working even though it hasn't expired.
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert response.status_code == 401


def test_change_password_requires_the_correct_current_password(client):
    token = signup(client, email="rider@example.com", password="correcthorse123").json()["access_token"]
    response = client.post(
        "/auth/change-password",
        json={"current_password": "wrong-current-password", "new_password": "newpass123"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


def test_change_password_succeeds_and_old_password_stops_working(client):
    token = signup(client, email="rider@example.com", password="correcthorse123").json()["access_token"]
    response = client.post(
        "/auth/change-password",
        json={"current_password": "correcthorse123", "new_password": "brand-new-password"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204

    old_login = client.post("/auth/login", json={"email": "rider@example.com", "password": "correcthorse123"})
    assert old_login.status_code == 401

    new_login = client.post("/auth/login", json={"email": "rider@example.com", "password": "brand-new-password"})
    assert new_login.status_code == 200
