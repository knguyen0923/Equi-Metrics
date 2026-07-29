"""Unit tests for app/config.py's Settings validation."""
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_rejects_a_jwt_secret_shorter_than_32_characters():
    with pytest.raises(ValidationError):
        Settings(mongodb_uri="mongodb://localhost:27017", jwt_secret="too-short")


def test_settings_accepts_a_jwt_secret_at_least_32_characters():
    settings = Settings(mongodb_uri="mongodb://localhost:27017", jwt_secret="a" * 32)
    assert settings.jwt_secret == "a" * 32
