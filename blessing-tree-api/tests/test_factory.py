from flask import Flask

from app.factory import build_cors_origins, configure_session_security


def test_build_cors_origins_adds_loopback_variant_for_localhost() -> None:
    origins = build_cors_origins("http://localhost:5173")

    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins


def test_build_cors_origins_adds_loopback_variant_for_127001() -> None:
    origins = build_cors_origins("http://127.0.0.1:4173")

    assert "http://127.0.0.1:4173" in origins
    assert "http://localhost:4173" in origins


def test_configure_session_security_sets_secret_and_cookie_policy() -> None:
    app = Flask(__name__)

    configure_session_security(
        app,
        secret_key="session-secret",
        cookie_secure=True,
        cookie_samesite="Lax",
    )

    assert app.secret_key == "session-secret"
    assert app.config["SECRET_KEY"] == "session-secret"
    assert app.config["SESSION_COOKIE_SECURE"] is True
    assert app.config["SESSION_COOKIE_SAMESITE"] == "Lax"
