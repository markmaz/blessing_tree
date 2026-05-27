from __future__ import annotations

import uuid
from collections.abc import Generator
from urllib.parse import parse_qs, urlparse

import pytest
from flask import Flask, jsonify
from flask_restx import Api
from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.exceptions.service_error import ServiceError
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
from app.routes.auth_routes import auth_ns
from app.services.auth.password_service import PasswordService


@compiles(TINYINT, "sqlite")
def _compile_tinyint_sqlite(_type, _compiler, **_kwargs) -> str:
    return "INTEGER"


class _SessionManager:
    def __init__(self, factory):
        self._factory = factory

    def __call__(self):
        return self._factory()


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Generator[Flask, None, None]:
    engine = create_engine("sqlite:///:memory:")
    from app.models.base import Base

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session_manager = _SessionManager(session_factory)

    monkeypatch.setattr("app.routes.auth_routes.SessionLocal", session_manager)

    flask_app = Flask(__name__)
    api = Api(flask_app)
    api.add_namespace(auth_ns, path="/api/v1/auth")

    @api.errorhandler(ServiceError)
    def handle_api_service_error(error: ServiceError):
        return error.to_dict(), error.status_code

    @flask_app.errorhandler(ServiceError)
    def handle_service_error(error: ServiceError):
        return jsonify(error.to_dict()), error.status_code

    yield flask_app


@pytest.fixture
def db_session(app) -> Generator[Session, None, None]:
    _ = app
    from app.routes.auth_routes import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_local_user(db: Session, *, email: str = "reset@example.com", password: str = "OldPass1") -> AuthIdentity:
    user = AppUser(
        id=uuid.uuid4(),
        email=email,
        display_name="Reset User",
        role="COORDINATOR",
        is_active=True,
    )
    db.add(user)
    db.flush()
    identity = AuthIdentity(
        id=uuid.uuid4(),
        user_id=user.id,
        provider="LOCAL",
        email=email,
        password_hash=PasswordService().hash_password(password),
        is_active=True,
    )
    db.add(identity)
    db.commit()
    db.refresh(identity)
    return identity


def test_password_reset_request_sends_generic_response_and_resets_password(
    app,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    queued: list[dict[str, str]] = []

    def capture_reset_email(email: str, display_name: str, reset_url: str):
        queued.append({"email": email, "display_name": display_name, "reset_url": reset_url})

    monkeypatch.setattr("app.tasks.admin_tasks.send_password_reset_email_task.delay", capture_reset_email)
    identity = seed_local_user(db_session)
    client = app.test_client()

    request_response = client.post(
        "/api/v1/auth/password/forgot",
        json={"email": "RESET@example.com"},
    )

    assert request_response.status_code == 200
    assert request_response.json["status"] == "ok"
    assert queued[0]["email"] == "reset@example.com"

    token = parse_qs(urlparse(queued[0]["reset_url"]).query)["token"][0]
    validate_response = client.get(f"/api/v1/auth/password/reset/validate/{token}")
    assert validate_response.status_code == 200
    assert validate_response.json["email"] == "reset@example.com"

    reset_response = client.post(
        "/api/v1/auth/password/reset",
        json={
            "token": token,
            "new_password": "NewPass1",
            "confirm_password": "NewPass1",
        },
    )

    assert reset_response.status_code == 200
    db_session.refresh(identity)
    password_service = PasswordService()
    assert not password_service.verify_password("OldPass1", identity.password_hash)
    assert password_service.verify_password("NewPass1", identity.password_hash)


def test_password_reset_request_does_not_disclose_unknown_email(
    app,
    monkeypatch: pytest.MonkeyPatch,
):
    queued: list[dict[str, str]] = []
    monkeypatch.setattr("app.tasks.admin_tasks.send_password_reset_email_task.delay", lambda *args: queued.append({}))
    client = app.test_client()

    response = client.post(
        "/api/v1/auth/password/forgot",
        json={"email": "missing@example.com"},
    )

    assert response.status_code == 200
    assert response.json["status"] == "ok"
    assert queued == []
