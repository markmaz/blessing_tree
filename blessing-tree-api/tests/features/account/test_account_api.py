from __future__ import annotations

import uuid
from collections.abc import Generator

import pytest
from flask import Flask, jsonify
from flask_restx import Api
from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.exceptions.service_error import ServiceError
from app.features.account import account_ns
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
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

    monkeypatch.setattr("app.features.account.api.SessionLocal", session_manager)

    flask_app = Flask(__name__)
    api = Api(flask_app)
    api.add_namespace(account_ns, path="/api/v1/account")

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
    from app.features.account.api import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def auth_header(user_id: str, role: str = "COORDINATOR") -> dict[str, str]:
    return {"Authorization": f"Bearer {user_id}:{role}"}


def install_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    def _verify(token: str):
        user_id, role = token.split(":", 1)
        return {"sub": user_id, "role": role, "name": f"user-{user_id}"}

    monkeypatch.setattr("app.decorators.security._auth_service.verify_token", _verify)


def seed_user(db: Session, *, role: str = "COORDINATOR") -> AppUser:
    user = AppUser(
        id=uuid.uuid4(),
        email="account@example.com",
        display_name="Account User",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_local_identity(db: Session, user: AppUser, password: str) -> AuthIdentity:
    identity = AuthIdentity(
        id=uuid.uuid4(),
        user_id=user.id,
        provider="LOCAL",
        email=user.email,
        password_hash=PasswordService().hash_password(password),
        is_active=True,
    )
    db.add(identity)
    db.commit()
    db.refresh(identity)
    return identity


def test_get_and_update_account_profile(app, db_session: Session, monkeypatch: pytest.MonkeyPatch):
    install_auth(monkeypatch)
    user = seed_user(db_session)
    client = app.test_client()

    response = client.get("/api/v1/account/profile", headers=auth_header(str(user.id)))

    assert response.status_code == 200
    assert response.json["profile"]["email"] == "account@example.com"
    assert response.json["profile"]["display_name"] == "Account User"

    update_response = client.patch(
        "/api/v1/account/profile",
        json={"display_name": "Updated User"},
        headers=auth_header(str(user.id)),
    )

    assert update_response.status_code == 200
    assert update_response.json["profile"]["display_name"] == "Updated User"


def test_get_and_update_account_settings(app, db_session: Session, monkeypatch: pytest.MonkeyPatch):
    install_auth(monkeypatch)
    user = seed_user(db_session)
    client = app.test_client()

    response = client.get("/api/v1/account/settings", headers=auth_header(str(user.id)))

    assert response.status_code == 200
    assert response.json["settings"]["timezone"] == "America/Chicago"
    assert response.json["settings"]["email_notifications_enabled"] is True

    update_response = client.put(
        "/api/v1/account/settings",
        json={
            "timezone": "UTC",
            "date_format": "YYYY_MM_DD",
            "default_landing_page": "CAMPAIGNS",
            "email_notifications_enabled": False,
        },
        headers=auth_header(str(user.id)),
    )

    assert update_response.status_code == 200
    assert update_response.json["settings"] == {
        "timezone": "UTC",
        "date_format": "YYYY_MM_DD",
        "default_landing_page": "CAMPAIGNS",
        "email_notifications_enabled": False,
        "created_at": update_response.json["settings"]["created_at"],
        "updated_at": update_response.json["settings"]["updated_at"],
    }


def test_change_account_password(app, db_session: Session, monkeypatch: pytest.MonkeyPatch):
    install_auth(monkeypatch)
    user = seed_user(db_session)
    identity = seed_local_identity(db_session, user, "OldPass1")
    client = app.test_client()

    response = client.put(
        "/api/v1/account/profile/password",
        json={
            "current_password": "OldPass1",
            "new_password": "NewPass1",
            "confirm_password": "NewPass1",
        },
        headers=auth_header(str(user.id)),
    )

    assert response.status_code == 200
    db_session.refresh(identity)
    password_service = PasswordService()
    assert not password_service.verify_password("OldPass1", identity.password_hash)
    assert password_service.verify_password("NewPass1", identity.password_hash)


def test_change_account_password_rejects_short_password(
    app,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    install_auth(monkeypatch)
    user = seed_user(db_session)
    seed_local_identity(db_session, user, "OldPass1")
    client = app.test_client()

    response = client.put(
        "/api/v1/account/profile/password",
        json={
            "current_password": "OldPass1",
            "new_password": "short",
            "confirm_password": "short",
        },
        headers=auth_header(str(user.id)),
    )

    assert response.status_code == 400
    assert response.json["error"] == "Password must be at least 8 characters."
