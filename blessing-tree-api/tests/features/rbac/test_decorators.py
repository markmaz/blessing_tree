from __future__ import annotations

from collections.abc import Generator

import pytest
from flask import Flask, jsonify

from app.features.rbac import decorators as rbac_decorators
from app.services.auth import AuthService


class _DummyQuery:
    def filter(self, *_args, **_kwargs):
        return self

    def one_or_none(self):
        return object()


class _DummySession:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def query(self, *_args, **_kwargs):
        return _DummyQuery()


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Generator[Flask, None, None]:
    auth_service = AuthService.__new__(AuthService)
    monkeypatch.setattr(rbac_decorators, "SessionLocal", lambda: _DummySession())
    monkeypatch.setattr("app.decorators.security._auth_service", auth_service)

    app = Flask(__name__)

    @app.errorhandler(Exception)
    def handle_error(error):
        if hasattr(error, "to_dict") and hasattr(error, "status_code"):
            return jsonify(error.to_dict()), error.status_code
        raise error

    @app.get("/admin")
    @rbac_decorators.require_app_admin()
    def admin_route():
        return jsonify({"ok": True})

    @app.get("/campaigns/<campaign_id>/check-in")
    @rbac_decorators.require_campaign_capability("campaign.gifts.check_in")
    def campaign_check_in(campaign_id: str):
        return jsonify({"campaign_id": campaign_id})

    @app.post("/campaigns/check-in")
    @rbac_decorators.require_campaign_capability(
        "campaign.gifts.check_in",
        allow_body_fallback=True,
    )
    def campaign_check_in_body():
        return jsonify({"campaign_id": "body"})

    yield app


def test_require_app_admin_rejects_missing_token(app: Flask) -> None:
    client = app.test_client()

    response = client.get("/admin")

    assert response.status_code == 401


def test_require_app_admin_allows_authorized_user(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    client = app.test_client()
    monkeypatch.setattr(
        "app.decorators.security._auth_service.verify_token",
        lambda token: {"sub": "user-1", "role": "ADMIN", "name": "Admin User"},
    )
    monkeypatch.setattr(
        rbac_decorators._authorization_service,
        "user_is_app_admin",
        lambda db, user_id: user_id == "user-1",
    )

    response = client.get("/admin", headers={"Authorization": "Bearer test-token"})

    assert response.status_code == 200
    assert response.get_json() == {"ok": True}


def test_require_campaign_capability_uses_path_scope(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    client = app.test_client()
    captured: dict[str, str] = {}
    monkeypatch.setattr(
        "app.decorators.security._auth_service.verify_token",
        lambda token: {"sub": "user-2", "role": "VOLUNTEER", "name": "Volunteer User"},
    )

    def _has_capability(db, user_id, campaign_id, capability):
        captured["user_id"] = user_id
        captured["campaign_id"] = campaign_id
        captured["capability"] = capability
        return True

    monkeypatch.setattr(
        rbac_decorators._authorization_service,
        "user_has_campaign_capability",
        _has_capability,
    )

    response = client.get(
        "/campaigns/campaign-123/check-in",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert captured == {
        "user_id": "user-2",
        "campaign_id": "campaign-123",
        "capability": "campaign.gifts.check_in",
    }


def test_require_campaign_capability_rejects_missing_scope(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    client = app.test_client()
    monkeypatch.setattr(
        "app.decorators.security._auth_service.verify_token",
        lambda token: {"sub": "user-2", "role": "VOLUNTEER"},
    )

    response = client.post(
        "/campaigns/check-in",
        json={},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 400
    assert response.get_json()["details"]["code"] == "missing_campaign_scope"


def test_require_campaign_capability_allows_body_scope_when_enabled(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    client = app.test_client()
    monkeypatch.setattr(
        "app.decorators.security._auth_service.verify_token",
        lambda token: {"sub": "user-2", "role": "VOLUNTEER"},
    )
    monkeypatch.setattr(
        rbac_decorators._authorization_service,
        "user_has_campaign_capability",
        lambda db, user_id, campaign_id, capability: campaign_id == "campaign-456",
    )

    response = client.post(
        "/campaigns/check-in",
        json={"campaign_id": "campaign-456"},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200


def test_require_campaign_capability_returns_forbidden_code(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    client = app.test_client()
    monkeypatch.setattr(
        "app.decorators.security._auth_service.verify_token",
        lambda token: {"sub": "user-3", "role": "VOLUNTEER"},
    )
    monkeypatch.setattr(
        rbac_decorators._authorization_service,
        "user_has_campaign_capability",
        lambda db, user_id, campaign_id, capability: False,
    )

    response = client.get(
        "/campaigns/campaign-789/check-in",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 403
    assert response.get_json()["details"] == {
        "code": "missing_campaign_capability",
        "campaign_id": "campaign-789",
        "capability": "campaign.gifts.check_in",
    }
