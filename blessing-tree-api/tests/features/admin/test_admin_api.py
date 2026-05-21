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
from app.features.admin import admin_ns
from app.routes.auth_routes import auth_ns


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

    monkeypatch.setattr("app.features.admin.api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.rbac.decorators.SessionLocal", session_manager)
    monkeypatch.setattr("app.routes.auth_routes.SessionLocal", session_manager)
    monkeypatch.setattr("app.tasks.admin_tasks.send_admin_invite_email_task.delay", lambda *args, **kwargs: None)

    app = Flask(__name__)
    app.config["SECRET_KEY"] = "test-secret-key"
    app.config["FRONTEND_BASE_URL"] = "http://localhost:5173"
    api = Api(app)
    api.add_namespace(admin_ns, path="/api/v1/admin")
    api.add_namespace(auth_ns, path="/api/v1/auth")

    @api.errorhandler(ServiceError)
    def handle_api_service_error(error: ServiceError):
        return error.to_dict(), error.status_code

    @app.errorhandler(ServiceError)
    def handle_service_error(error: ServiceError):
        return jsonify(error.to_dict()), error.status_code

    yield app


@pytest.fixture
def client(app: Flask):
    return app.test_client()


def auth_header(user_id: str, role: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_id}:{role}"}


def install_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    def _verify(token: str):
        user_id, role = token.split(":", 1)
        return {"sub": user_id, "role": role, "name": f"user-{user_id}"}

    monkeypatch.setattr("app.decorators.security._auth_service.verify_token", _verify)


def seed_user(db: Session, *, email: str, role: str = "VOLUNTEER", name: str = "Test User"):
    from app.models.app_user import AppUser

    user = AppUser(
        id=uuid.uuid4(),
        email=email,
        display_name=name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def test_admin_invitation_accept_flow(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin@blessingtree.test", role="ADMIN", name="Admin User")
        admin_user_id = str(admin_user.id)
        db.commit()

    create_response = client.post(
        "/api/v1/admin/users",
        json={
            "email": "invitee@blessingtree.test",
            "display_name": "Invited User",
            "role": "COORDINATOR",
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert create_response.status_code == 201
    invite_url = create_response.get_json()["invitation"]["invite_url"]
    token = invite_url.split("token=", 1)[1]

    validate_response = client.get(f"/api/v1/auth/invite/validate/{token}")
    assert validate_response.status_code == 200
    assert validate_response.get_json()["email"] == "invitee@blessingtree.test"

    accept_response = client.post(
        f"/api/v1/auth/invite/accept?token={token}",
        json={
            "display_name": "Invited User Accepted",
            "email": "invitee@blessingtree.test",
            "password": "BlessingTree12345!",
        },
    )

    assert accept_response.status_code == 200
    assert accept_response.get_json()["status"] == "active"


def test_invite_google_login_stashes_token_and_redirects(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin-invite@blessingtree.test", role="ADMIN", name="Admin User")
        admin_user_id = str(admin_user.id)
        db.commit()

    create_response = client.post(
        "/api/v1/admin/users",
        json={
            "email": "oauth-invitee@blessingtree.test",
            "display_name": "OAuth Invitee",
            "role": "COORDINATOR",
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    token = create_response.get_json()["invitation"]["invite_url"].split("token=", 1)[1]

    monkeypatch.setattr(
        "app.routes.auth_routes._oauth_service.authorize_redirect",
        lambda provider, redirect_uri: jsonify(
            {"provider": provider, "redirect_uri": redirect_uri}
        ),
    )

    response = client.get(
        f"/api/v1/auth/invite/google/login?token={token}&redirect_uri=http://localhost:5000/api/v1/auth/google/callback"
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "provider": "GOOGLE",
        "redirect_uri": "http://localhost:5000/api/v1/auth/google/callback",
    }

    with client.session_transaction() as session:
        assert session["bt_invite_token"] == token
        assert session["bt_invite_provider"] == "GOOGLE"


def test_invite_google_callback_accepts_invitation_and_links_identity(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api
    from app.models.admin_user_invitation import AdminUserInvitation
    from app.models.auth import AuthIdentity
    from app.services.auth.oauth_service import OAuthUserInfo

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin-oauth@blessingtree.test", role="ADMIN", name="Admin User")
        admin_user_id = str(admin_user.id)
        db.commit()

    create_response = client.post(
        "/api/v1/admin/users",
        json={
            "email": "oauth-complete@blessingtree.test",
            "display_name": "OAuth Complete",
            "role": "COORDINATOR",
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    token = create_response.get_json()["invitation"]["invite_url"].split("token=", 1)[1]

    monkeypatch.setattr(
        "app.routes.auth_routes._oauth_service.fetch_userinfo_from_callback",
        lambda provider: OAuthUserInfo(
            sub="google-sub-123",
            email="oauth-complete@blessingtree.test",
            name="OAuth Complete",
        ),
    )

    with client.session_transaction() as session:
        session["bt_invite_token"] = token
        session["bt_invite_provider"] = "GOOGLE"

    response = client.get("/api/v1/auth/google/callback")

    assert response.status_code == 302
    assert response.headers["Location"] == "http://localhost:5173/auth/callback"
    assert "bt_refresh=" in response.headers.get("Set-Cookie", "")

    with admin_api.SessionLocal() as db:
        invitation = db.query(AdminUserInvitation).filter(AdminUserInvitation.email == "oauth-complete@blessingtree.test").one()
        identity = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.user_id == invitation.user_id, AuthIdentity.provider == "GOOGLE")
            .one()
        )

        assert invitation.accepted_at is not None
        assert identity.provider_sub == "google-sub-123"
        assert identity.email == "oauth-complete@blessingtree.test"

    with client.session_transaction() as session:
        assert "bt_invite_token" not in session
        assert "bt_invite_provider" not in session


def test_feature_flags_list_and_update(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin2@blessingtree.test", role="ADMIN", name="Admin User")
        regular_user = seed_user(db, email="user@blessingtree.test", role="COORDINATOR", name="Standard User")
        admin_user_id = str(admin_user.id)
        regular_user_id = str(regular_user.id)
        db.commit()

    list_response = client.get(
        "/api/v1/admin/features",
        headers=auth_header(regular_user_id, "COORDINATOR"),
    )
    assert list_response.status_code == 200
    assert len(list_response.get_json()["features"]) >= 4

    update_response = client.put(
        "/api/v1/admin/features/families",
        json={"is_enabled": False},
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["feature"]["is_enabled"] is False


def test_llm_config_and_health(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    from app.features.admin import api as admin_api

    class _FakeResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"data": [{"id": "demo-model"}]}

    monkeypatch.setattr("app.features.admin.llm_service.requests.get", lambda *args, **kwargs: _FakeResponse())

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin3@blessingtree.test", role="ADMIN", name="Admin User")
        admin_user_id = str(admin_user.id)
        db.commit()

    save_response = client.put(
        "/api/v1/admin/llm",
        json={
            "provider": "OPENAI_COMPATIBLE",
            "label": "Primary LLM",
            "base_url": "http://llm.local/v1",
            "model": "demo-model",
            "api_key": "secret-key",
            "is_enabled": True,
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert save_response.status_code == 200
    assert save_response.get_json()["configuration"]["api_key_configured"] is True

    test_response = client.post(
        "/api/v1/admin/llm/test",
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert test_response.status_code == 200
    assert test_response.get_json()["status"] == "ok"

    health_response = client.get(
        "/api/v1/admin/health",
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert health_response.status_code == 200
    assert "checks" in health_response.get_json()
