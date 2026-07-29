"""Unit tests for app/security.py — password hashing and JWT issuing/
verification. These don't need the database or a running app, just the
pure functions.
"""

import jwt
import pytest

from app import security


def test_hash_password_produces_a_verifiable_but_different_hash_each_time():
    # bcrypt salts randomly, so hashing the same password twice must not
    # produce the same string — otherwise two users with the same password
    # would be trivially linkable in a leaked database.
    hash_a = security.hash_password("correct horse battery staple")
    hash_b = security.hash_password("correct horse battery staple")

    assert hash_a != hash_b
    assert security.verify_password("correct horse battery staple", hash_a)
    assert security.verify_password("correct horse battery staple", hash_b)


def test_verify_password_rejects_a_wrong_password():
    password_hash = security.hash_password("the-real-password")
    assert not security.verify_password("a-guess", password_hash)


def test_access_token_round_trips_the_user_id_and_token_version():
    token = security.create_access_token(user_id="abc123", token_version=3)
    payload = security.decode_access_token(token)

    assert payload["sub"] == "abc123"
    assert payload["token_version"] == 3


def test_decode_access_token_rejects_a_token_signed_with_a_different_secret():
    # Simulates a forged/leaked-from-elsewhere token — decoding must fail
    # rather than trust whatever secret the token itself claims to use.
    forged = jwt.encode({"sub": "abc123", "token_version": 0}, "some-other-secret", algorithm="HS256")

    with pytest.raises(Exception):
        security.decode_access_token(forged)


def test_decode_access_token_rejects_an_expired_token():
    from datetime import datetime, timedelta, timezone

    from app.config import settings

    expired_payload = {
        "sub": "abc123",
        "token_version": 0,
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret, algorithm="HS256")

    with pytest.raises(Exception):
        security.decode_access_token(expired_token)


def test_reset_token_hash_is_deterministic_but_the_raw_token_is_not_guessable():
    raw_a, hash_a = security.generate_reset_token()
    raw_b, hash_b = security.generate_reset_token()

    # Two calls produce different random tokens...
    assert raw_a != raw_b
    # ...but hashing the same raw token twice always gives the same digest,
    # since reset_password() looks a token up by re-hashing what the user
    # submitted and comparing against the stored hash.
    assert security.hash_reset_token(raw_a) == hash_a
    assert security.hash_reset_token(raw_a) == security.hash_reset_token(raw_a)
