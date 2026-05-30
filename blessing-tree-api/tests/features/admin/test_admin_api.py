from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import datetime

import pytest
import requests
from flask import Flask, jsonify
from flask_restx import Api
from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.exceptions.service_error import ServiceError
from app.features.admin.llm_runtime_service import LlmRuntimeUnavailableError
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
    seed_session = session_factory()
    _seed_default_milestone_definitions(seed_session)
    seed_session.commit()
    seed_session.close()
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


def seed_campaign(db: Session, *, name: str, year: int = 2026, status: str = "ACTIVE"):
    from app.models.campaign import Campaign

    campaign = Campaign(
        id=uuid.uuid4(),
        name=name,
        year=year,
        status=status,
    )
    db.add(campaign)
    db.flush()
    return campaign


def _seed_default_milestone_definitions(db: Session) -> None:
    from app.features.campaigns.studio_constants import MILESTONE_DEFINITIONS
    from app.models.campaign_milestone_definition import CampaignMilestoneDefinition

    for sort_order, (milestone_key, label) in enumerate(MILESTONE_DEFINITIONS.items(), start=1):
        db.add(
            CampaignMilestoneDefinition(
                id=uuid.uuid4(),
                milestone_key=milestone_key,
                label=label,
                feature_area="GENERAL",
                default_sort_order=sort_order,
                is_active=True,
                is_system=True,
            )
        )


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
    assert validate_response.get_json()["status"] == "pending"
    assert validate_response.get_json()["onboarding_complete"] is False

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

    post_accept_validate_response = client.get(f"/api/v1/auth/invite/validate/{token}")
    assert post_accept_validate_response.status_code == 200
    assert post_accept_validate_response.get_json()["status"] == "accepted"
    assert post_accept_validate_response.get_json()["onboarding_complete"] is True
    assert post_accept_validate_response.get_json()["has_local_identity"] is True


def test_admin_can_manage_campaign_operation_definitions(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="ops-admin@blessingtree.test", role="ADMIN", name="Ops Admin")
        admin_user_id = str(admin_user.id)
        db.commit()

    headers = auth_header(admin_user_id, "ADMIN")

    milestone_response = client.post(
        "/api/v1/admin/campaign-operations/milestone-definitions",
        json={
            "milestone_key": "custom_turn_in",
            "label": "Custom Turn-In",
            "description": "Custom admin-defined date.",
            "feature_area": "GIFTS",
            "default_sort_order": 50,
        },
        headers=headers,
    )

    assert milestone_response.status_code == 201
    milestone = milestone_response.get_json()["milestone_definition"]
    assert milestone["milestone_key"] == "custom_turn_in"
    assert milestone["feature_area"] == "GIFTS"

    duplicate_response = client.post(
        "/api/v1/admin/campaign-operations/milestone-definitions",
        json={
            "milestone_key": "custom_turn_in",
            "label": "Duplicate",
            "feature_area": "GIFTS",
        },
        headers=headers,
    )
    assert duplicate_response.status_code == 409

    options_response = client.get(
        "/api/v1/admin/campaign-operations/readiness-rule-options",
        headers=headers,
    )
    assert options_response.status_code == 200
    assert "CAMPAIGN_FIELD_TRUE" in options_response.get_json()["condition_types"]
    assert any(item["milestone_key"] == "custom_turn_in" for item in options_response.get_json()["milestone_definitions"])

    rule_response = client.post(
        "/api/v1/admin/campaign-operations/readiness-rules",
        json={
            "rule_key": "missing_custom_turn_in",
            "name": "Missing Custom Turn-In",
            "rule_type": "MISSING_MILESTONE",
            "feature_area": "GIFTS",
            "condition_type": "ALWAYS",
            "milestone_key": "custom_turn_in",
            "severity": "warning",
            "category": "launch_checks",
            "blocking_for": ["activate"],
            "section": "schedule",
            "message": "Add the custom turn-in milestone.",
        },
        headers=headers,
    )

    assert rule_response.status_code == 201
    rule = rule_response.get_json()["readiness_rule"]
    assert rule["rule_key"] == "missing_custom_turn_in"
    assert rule["blocking_for"] == ["activate"]

    blocked_deactivate_response = client.patch(
        f"/api/v1/admin/campaign-operations/milestone-definitions/{milestone['id']}",
        json={"is_active": False},
        headers=headers,
    )
    assert blocked_deactivate_response.status_code == 409
    blocked_payload = blocked_deactivate_response.get_json()
    assert blocked_payload["details"]["milestone_key"] == "custom_turn_in"
    assert blocked_payload["details"]["active_readiness_rule_count"] == 1

    patch_response = client.patch(
        f"/api/v1/admin/campaign-operations/readiness-rules/{rule['id']}",
        json={"is_active": False, "message": "Custom turn-in is currently disabled."},
        headers=headers,
    )
    assert patch_response.status_code == 200
    assert patch_response.get_json()["readiness_rule"]["is_active"] is False

    deactivate_response = client.patch(
        f"/api/v1/admin/campaign-operations/milestone-definitions/{milestone['id']}",
        json={"is_active": False},
        headers=headers,
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.get_json()["milestone_definition"]["is_active"] is False


def test_admin_can_manage_organization_types(
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="org-types-admin@blessingtree.test", role="ADMIN", name="Org Type Admin")
        admin_user_id = str(admin_user.id)
        db.commit()

    headers = auth_header(admin_user_id, "ADMIN")

    list_response = client.get("/api/v1/admin/organization-types", headers=headers)
    assert list_response.status_code == 200
    seeded_codes = {row["code"] for row in list_response.get_json()["organization_types"]}
    assert {"NURSING_HOME", "FOSTER_CARE", "MH_CLIENTS", "FAMILY_SERVICES"}.issubset(seeded_codes)

    create_response = client.post(
        "/api/v1/admin/organization-types",
        json={
            "label": "School Partners",
            "recipient_category": "FAMILY",
            "sort_order": 15,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    created = create_response.get_json()["organization_type"]
    assert created["code"] == "SCHOOL_PARTNERS"
    assert created["recipient_category"] == "FAMILY"

    patch_response = client.patch(
        "/api/v1/admin/organization-types/SCHOOL_PARTNERS",
        json={
            "label": "School Partner Program",
            "recipient_category": "FAMILY",
            "is_active": False,
            "sort_order": 16,
        },
        headers=headers,
    )
    assert patch_response.status_code == 200
    patched = patch_response.get_json()["organization_type"]
    assert patched["label"] == "School Partner Program"
    assert patched["recipient_category"] == "FAMILY"
    assert patched["is_active"] is False


def test_admin_audit_event_api_lists_filters_and_returns_detail(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api
    from app.features.admin.audit_service import AuditEventService

    audit_service = AuditEventService()
    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="audit-admin@blessingtree.test", role="ADMIN", name="Audit Admin")
        other_user = seed_user(db, email="other-audit@blessingtree.test", role="COORDINATOR", name="Other User")
        campaign = seed_campaign(db, name="Audit Campaign")

        with app.test_request_context(
            "/api/v1/admin/audit-events",
            headers={"User-Agent": "Audit Test Browser", "X-Forwarded-For": "203.0.113.10"},
        ):
            from flask import g

            g.correlation_id = "corr-audit-1"
            event = audit_service.record_event(
                db,
                area="gifts",
                action="status_changed",
                entity_type="wishlist_item",
                entity_id=uuid.uuid4(),
                entity_label="Art Kit",
                campaign_id=campaign.id,
                actor_user_id=admin_user.id,
                summary="Audit Admin changed Art Kit from Ready to Distributed.",
                changes=[
                    {
                        "field": "status",
                        "label": "Status",
                        "before": "Ready",
                        "after": "Distributed",
                    },
                    {
                        "field": "password",
                        "label": "Password",
                        "before": "old-secret",
                        "after": "new-secret",
                    },
                ],
                metadata={"source": "unit-test", "api_key": "secret-value"},
            )
        audit_service.record_event(
            db,
            area="people",
            action="created",
            entity_type="recipient_group",
            entity_label="Johnson Household",
            campaign_id=campaign.id,
            actor_user_id=other_user.id,
            summary="Other User created Johnson Household.",
        )
        event_id = str(event.id)
        db.commit()
        admin_user_id = str(admin_user.id)

    list_response = client.get(
        "/api/v1/admin/audit-events?area=gifts&search=Art&page_size=10",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert list_response.status_code == 200
    list_payload = list_response.get_json()
    assert list_payload["pagination"]["total"] == 1
    assert list_payload["filters"]["areas"]
    item = list_payload["items"][0]
    assert item["id"] == event_id
    assert item["area"] == "gifts"
    assert item["action"] == "status_changed"
    assert item["entity_label"] == "Art Kit"
    assert item["change_count"] == 2
    assert item["actor"]["display_name"] == "Audit Admin"
    assert item["campaign"]["name"] == "Audit Campaign"

    detail_response = client.get(
        f"/api/v1/admin/audit-events/{event_id}",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert detail_response.status_code == 200
    detail = detail_response.get_json()["event"]
    assert detail["correlation_id"] == "corr-audit-1"
    assert detail["ip_address"] == "203.0.113.10"
    assert detail["user_agent"] == "Audit Test Browser"
    assert detail["change_set"][0] == {
        "field": "status",
        "label": "Status",
        "before": "Ready",
        "after": "Distributed",
    }
    assert detail["change_set"][1]["before"] == "[redacted]"
    assert detail["metadata"]["source"] == "unit-test"
    assert detail["metadata"]["api_key"] == "[redacted]"


def test_admin_audit_event_api_requires_app_admin(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api
    from app.features.admin.audit_service import AuditEventService

    with admin_api.SessionLocal() as db:
        non_admin = seed_user(db, email="audit-viewer@blessingtree.test", role="VOLUNTEER", name="Audit Viewer")
        AuditEventService().record_event(
            db,
            area="admin",
            action="created",
            entity_type="app_user",
            entity_label="Sample User",
            summary="Sample User was created.",
        )
        non_admin_id = str(non_admin.id)
        db.commit()

    response = client.get(
        "/api/v1/admin/audit-events",
        headers=auth_header(non_admin_id, "VOLUNTEER"),
    )

    assert response.status_code == 403


def test_admin_audit_event_api_validates_bad_filters(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="audit-filter-admin@blessingtree.test", role="ADMIN", name="Audit Admin")
        admin_user_id = str(admin_user.id)
        db.commit()

    response = client.get(
        "/api/v1/admin/audit-events?campaign_id=not-a-uuid",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert response.status_code == 400


def test_admin_mutations_write_audit_events(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="audit-writer-admin@blessingtree.test", role="ADMIN", name="Audit Writer")
        admin_user_id = str(admin_user.id)
        db.commit()

    headers = auth_header(admin_user_id, "ADMIN")

    invite_response = client.post(
        "/api/v1/admin/users",
        json={
            "email": "audit-invitee@blessingtree.test",
            "display_name": "Audit Invitee",
            "role": "COORDINATOR",
        },
        headers=headers,
    )
    assert invite_response.status_code == 201

    feature_response = client.put(
        "/api/v1/admin/features/people",
        json={"is_enabled": False},
        headers=headers,
    )
    assert feature_response.status_code == 200

    organization_type_response = client.post(
        "/api/v1/admin/organization-types",
        json={
            "label": "Audit Partners",
            "recipient_category": "FAMILY",
            "sort_order": 42,
        },
        headers=headers,
    )
    assert organization_type_response.status_code == 201

    audit_response = client.get(
        "/api/v1/admin/audit-events?area=admin&page_size=20",
        headers=headers,
    )
    assert audit_response.status_code == 200
    events = audit_response.get_json()["items"]
    entity_types = {event["entity_type"] for event in events}
    assert {"app_user", "feature_flag", "organization_type"}.issubset(entity_types)
    invite_event = next(event for event in events if event["entity_type"] == "app_user")
    assert invite_event["actor"]["display_name"] == "Audit Writer"
    assert invite_event["summary"] == "Invited user Audit Invitee."

    detail_response = client.get(
        f"/api/v1/admin/audit-events/{invite_event['id']}",
        headers=headers,
    )
    assert detail_response.status_code == 200
    detail = detail_response.get_json()["event"]
    changed_fields = {change["field"] for change in detail["change_set"]}
    assert {"email", "display_name", "role", "is_active"}.issubset(changed_fields)


def test_campaign_operation_definition_mutation_requires_admin(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        user = seed_user(db, email="not-admin@blessingtree.test", role="VOLUNTEER", name="Not Admin")
        user_id = str(user.id)
        db.commit()

    response = client.post(
        "/api/v1/admin/campaign-operations/milestone-definitions",
        json={
            "milestone_key": "blocked_for_non_admin",
            "label": "Blocked",
            "feature_area": "GENERAL",
        },
        headers=auth_header(user_id, "VOLUNTEER"),
    )

    assert response.status_code == 403


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
        "/api/v1/admin/features/people",
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

    monkeypatch.setattr(
        "app.features.admin.llm_runtime_service.AdminLlmRuntimeService._request_json",
        lambda *args, **kwargs: {"ok": True, "message": "ready"},
    )
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
    assert test_response.get_json()["message"] == "LLM connection and generation test succeeded."

    health_response = client.get(
        "/api/v1/admin/health",
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert health_response.status_code == 200
    assert "checks" in health_response.get_json()


def test_llm_test_surfaces_model_access_failure(
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
            return {"data": [{"id": "gpt-4o-mini"}]}

    monkeypatch.setattr(
        "app.features.admin.llm_runtime_service.AdminLlmRuntimeService._request_json",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            LlmRuntimeUnavailableError(
                "Configured LLM request failed: 403 Client Error: Forbidden for url: https://api.openai.com/v1/chat/completions"
            )
        ),
    )
    monkeypatch.setattr("app.features.admin.llm_service.requests.get", lambda *args, **kwargs: _FakeResponse())

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin4@blessingtree.test", role="ADMIN", name="Admin User")
        admin_user_id = str(admin_user.id)
        db.commit()

    client.put(
        "/api/v1/admin/llm",
        json={
            "provider": "OPENAI",
            "label": "Primary LLM",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4.1",
            "api_key": "secret-key",
            "is_enabled": True,
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    test_response = client.post(
        "/api/v1/admin/llm/test",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert test_response.status_code == 200
    payload = test_response.get_json()
    assert payload["status"] == "error"
    assert "Selected model `gpt-4.1` was not returned" in payload["message"]


def test_llm_models_returns_available_models(
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
            return {"data": [{"id": "gpt-4o-mini"}, {"id": "gpt-4.1-mini"}]}

    monkeypatch.setattr("app.features.admin.llm_service.requests.get", lambda *args, **kwargs: _FakeResponse())

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin5@blessingtree.test", role="ADMIN", name="Admin User")
        admin_user_id = str(admin_user.id)
        db.commit()

    client.put(
        "/api/v1/admin/llm",
        json={
            "provider": "OPENAI",
            "label": "Primary LLM",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "secret-key",
            "is_enabled": True,
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    models_response = client.get(
        "/api/v1/admin/llm/models",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert models_response.status_code == 200
    payload = models_response.get_json()
    assert payload["configured"] is True
    assert payload["models"] == ["gpt-4o-mini", "gpt-4.1-mini"]


def test_llm_models_surfaces_catalog_load_failure(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin-model-error@blessingtree.test", role="ADMIN", name="Admin User")
        admin_user_id = str(admin_user.id)
        db.commit()

    save_response = client.put(
        "/api/v1/admin/llm",
        json={
            "provider": "OPENAI",
            "label": "Primary LLM",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4.1-mini",
            "api_key": "test-key",
            "is_enabled": True,
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert save_response.status_code == 200

    class _BoomResponse:
        def raise_for_status(self):
            raise requests.HTTPError("401 Client Error: Unauthorized for url: https://api.openai.com/v1/models")

    monkeypatch.setattr(
        "app.features.admin.llm_service.requests.get",
        lambda *args, **kwargs: _BoomResponse(),
    )

    response = client.get("/api/v1/admin/llm/models", headers=auth_header(admin_user_id, "ADMIN"))

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["configured"] is True
    assert payload["models"] == []
    assert "Unable to load provider model catalog" in payload["message"]


def test_admin_can_deactivate_and_reactivate_user(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin-status@blessingtree.test", role="ADMIN", name="Admin User")
        member_user = seed_user(db, email="member-status@blessingtree.test", role="COORDINATOR", name="Member User")
        admin_user_id = str(admin_user.id)
        member_user_id = str(member_user.id)
        db.commit()

    deactivate_response = client.patch(
        f"/api/v1/admin/users/{member_user_id}/status",
        json={"is_active": False},
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.get_json()["user"]["is_active"] is False

    reactivate_response = client.patch(
        f"/api/v1/admin/users/{member_user_id}/status",
        json={"is_active": True},
        headers=auth_header(admin_user_id, "ADMIN"),
    )
    assert reactivate_response.status_code == 200
    assert reactivate_response.get_json()["user"]["is_active"] is True


def test_admin_can_delete_deactivated_user(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api
    from app.models.admin_user_invitation import AdminUserInvitation
    from app.models.app_user import AppUser
    from app.models.auth import AuthIdentity

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="delete-admin@blessingtree.test", role="ADMIN", name="Delete Admin")
        member_user = seed_user(db, email="delete-member@blessingtree.test", role="COORDINATOR", name="Delete Member")
        member_user.is_active = False
        member_user_id = str(member_user.id)
        admin_user_id = str(admin_user.id)
        db.add(
            AuthIdentity(
                id=uuid.uuid4(),
                user_id=member_user.id,
                provider="LOCAL",
                provider_sub=None,
                email=member_user.email,
                password_hash="hash",
                is_active=True,
            )
        )
        db.add(
            AdminUserInvitation(
                id=uuid.uuid4(),
                user_id=member_user.id,
                email=member_user.email,
                invited_by_user_id=admin_user.id,
                expires_at=datetime.utcnow(),
            )
        )
        db.commit()

    response = client.delete(
        f"/api/v1/admin/users/{member_user_id}",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert response.status_code == 204
    with admin_api.SessionLocal() as db:
        assert db.get(AppUser, uuid.UUID(member_user_id)) is None
        assert db.query(AuthIdentity).filter(AuthIdentity.user_id == uuid.UUID(member_user_id)).count() == 0
        assert db.query(AdminUserInvitation).filter(AdminUserInvitation.user_id == uuid.UUID(member_user_id)).count() == 0


def test_admin_cannot_delete_active_user(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="active-delete-admin@blessingtree.test", role="ADMIN", name="Delete Admin")
        member_user = seed_user(db, email="active-delete-member@blessingtree.test", role="COORDINATOR", name="Active Member")
        member_user_id = str(member_user.id)
        admin_user_id = str(admin_user.id)
        db.commit()

    response = client.delete(
        f"/api/v1/admin/users/{member_user_id}",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert response.status_code == 409
    assert response.get_json()["error"] == "Only deactivated users can be deleted"


def test_admin_cannot_delete_own_user(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)

    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="self-delete-admin@blessingtree.test", role="ADMIN", name="Delete Admin")
        admin_user_id = str(admin_user.id)
        db.commit()

    response = client.delete(
        f"/api/v1/admin/users/{admin_user_id}",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert response.status_code == 409
    assert response.get_json()["error"] == "You cannot delete your own user account"


def test_admin_can_update_user_global_app_role(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin-role@blessingtree.test", role="ADMIN", name="Admin User")
        member_user = seed_user(db, email="member-role@blessingtree.test", role="COORDINATOR", name="Member User")
        admin_user_id = str(admin_user.id)
        member_user_id = str(member_user.id)
        db.commit()

    response = client.patch(
        f"/api/v1/admin/users/{member_user_id}/role",
        json={"role": "ADMIN"},
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "ADMIN"


def test_admin_can_manage_simple_campaign_access(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    from app.features.admin import api as admin_api
    from app.features.rbac.models.campaign_user_role import CampaignUserRole

    with admin_api.SessionLocal() as db:
        admin_user = seed_user(db, email="admin-access@blessingtree.test", role="ADMIN", name="Admin User")
        member_user = seed_user(db, email="member-access@blessingtree.test", role="COORDINATOR", name="Member User")
        campaign = seed_campaign(db, name="Holiday 2026")
        other_campaign = seed_campaign(db, name="Holiday 2025", year=2025)
        admin_user_id = str(admin_user.id)
        member_user_id = str(member_user.id)
        campaign_id = str(campaign.id)
        other_campaign_id = str(other_campaign.id)
        db.commit()

    update_response = client.put(
        f"/api/v1/admin/users/{member_user_id}/campaign-access",
        json={
            "assignments": [
                {"campaign_id": campaign_id, "role_keys": ["GIFT_CHECKIN"]},
                {"campaign_id": other_campaign_id, "role_keys": []},
            ],
        },
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert update_response.status_code == 200
    update_payload = update_response.get_json()
    assert update_payload["user_id"] == member_user_id
    assert any(item["role_key"] == "GIFT_OPERATIONS" for item in update_payload["role_catalog"])
    assigned_campaign = next(row for row in update_payload["campaigns"] if row["campaign"]["id"] == campaign_id)
    unassigned_campaign = next(row for row in update_payload["campaigns"] if row["campaign"]["id"] == other_campaign_id)
    assert assigned_campaign["role_keys"] == ["GIFT_OPERATIONS"]
    assert "campaign.gifts.check_in" in assigned_campaign["capabilities"]
    assert "campaign.gifts.distribute" in assigned_campaign["capabilities"]
    assert unassigned_campaign["role_keys"] == []
    assert unassigned_campaign["capabilities"] == []

    get_response = client.get(
        f"/api/v1/admin/users/{member_user_id}/campaign-access",
        headers=auth_header(admin_user_id, "ADMIN"),
    )

    assert get_response.status_code == 200
    get_payload = get_response.get_json()
    get_assigned_campaign = next(row for row in get_payload["campaigns"] if row["campaign"]["id"] == campaign_id)
    assert get_assigned_campaign["role_keys"] == ["GIFT_OPERATIONS"]

    with admin_api.SessionLocal() as db:
        rows = db.query(CampaignUserRole).filter(CampaignUserRole.user_id == uuid.UUID(member_user_id)).all()
        assert [(str(row.campaign_id), row.role_key) for row in rows] == [(campaign_id, "GIFT_OPERATIONS")]


def test_campaign_access_management_requires_app_admin(
    app: Flask,
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    from app.features.admin import api as admin_api

    with admin_api.SessionLocal() as db:
        user = seed_user(db, email="access-nonadmin@blessingtree.test", role="COORDINATOR", name="Not Admin")
        target_user = seed_user(db, email="access-target@blessingtree.test", role="COORDINATOR", name="Target")
        user_id = str(user.id)
        target_user_id = str(target_user.id)
        db.commit()

    response = client.get(
        f"/api/v1/admin/users/{target_user_id}/campaign-access",
        headers=auth_header(user_id, "COORDINATOR"),
    )

    assert response.status_code == 403
