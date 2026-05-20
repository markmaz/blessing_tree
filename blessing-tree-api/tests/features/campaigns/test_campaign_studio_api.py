from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import date

import pytest
from flask import Flask, jsonify
from flask_restx import Api
from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.exceptions.service_error import ServiceError
from app.features.campaigns import api as campaign_api_module
from app.features.campaigns import campaign_ns
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.models.app_user import AppUser
from app.models.base import Base
from app.models.campaign import Campaign
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate


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
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session_manager = _SessionManager(session_factory)

    monkeypatch.setattr("app.features.campaigns.api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.campaigns.studio_api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.rbac.decorators.SessionLocal", session_manager)

    app = Flask(__name__)
    api = Api(app)
    api.add_namespace(campaign_ns, path="/api/v1/campaigns")

    @api.errorhandler(ServiceError)
    def handle_api_service_error(error: ServiceError):
        return error.to_dict(), error.status_code

    @app.errorhandler(ServiceError)
    def handle_service_error(error: ServiceError):
        return jsonify(error.to_dict()), error.status_code

    yield app


def _auth_header(user_id: str, role: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_id}:{role}"}


def _install_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    def _verify(token: str):
        user_id, role = token.split(":", 1)
        return {"sub": user_id, "role": role, "name": f"user-{user_id}"}

    monkeypatch.setattr("app.decorators.security._auth_service.verify_token", _verify)


def _seed_user(db: Session, *, role: str = "VOLUNTEER", name: str = "Test User") -> AppUser:
    user = AppUser(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        display_name=name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _seed_campaign(db: Session, *, year: int = 2026, name: str = "Studio Campaign") -> Campaign:
    campaign = Campaign(
        id=uuid.uuid4(),
        name=name,
        description="Studio-ready campaign",
        year=year,
        start_date=date(year, 11, 1),
        end_date=date(year, 12, 31),
        status="ACTIVE",
    )
    db.add(campaign)
    db.flush()
    return campaign


def _assign_role(db: Session, user: AppUser, campaign: Campaign, role_key: str) -> CampaignUserRole:
    assignment = CampaignUserRole(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        user_id=user.id,
        role_key=role_key,
        is_active=True,
    )
    db.add(assignment)
    db.flush()
    return assignment


def test_get_campaign_studio_returns_aggregate_payload(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = _seed_user(session, name="Manager User")
    campaign = _seed_campaign(session)
    _assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        template_key="sponsor_reminder",
        name="Sponsor Reminder",
        audience="SPONSOR",
        channel="EMAIL",
        subject_template="Reminder",
        body_template="Please sponsor.",
        is_active=True,
        created_by_user_id=manager.id,
    )
    milestone = CampaignMilestone(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        milestone_key="registration_open",
        label="Registration Opens",
        occurs_on=date(2026, 9, 1),
        sort_order=1,
    )
    session.add_all([template, milestone])
    session.flush()
    session.add(
        CampaignCommunicationSchedule(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            template_id=template.id,
            milestone_key="registration_open",
            status="SCHEDULED",
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/studio",
        headers=_auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["campaign"]["id"] == campaign_id
    assert payload["team"]["counts"]["manager_count"] == 1
    assert payload["communications"]["templates"][0]["template_key"] == "sponsor_reminder"
    assert payload["communications"]["schedules"][0]["status"] == "SCHEDULED"
    assert payload["milestones"][0]["milestone_key"] == "registration_open"
    assert payload["readiness"]["status"] == "NEEDS_ATTENTION"


def test_post_assignment_creates_campaign_role_assignment(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = _seed_user(session, name="Manager User")
    volunteer = _seed_user(session, name="Volunteer User")
    campaign = _seed_campaign(session)
    _assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    volunteer_id = str(volunteer.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/assignments",
        json={"user_id": volunteer_id, "role_key": "VOLUNTEER_VIEWER"},
        headers=_auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["role_key"] == "VOLUNTEER_VIEWER"
    assert payload["user"]["display_name"] == "Volunteer User"


def test_get_directory_users_returns_matching_active_users_with_assignment_context(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = _seed_user(session, name="Manager User")
    volunteer = _seed_user(session, name="Volunteer Candidate")
    _seed_user(session, name="Different Person")
    inactive = _seed_user(session, name="Inactive Volunteer")
    inactive.is_active = False
    campaign = _seed_campaign(session)
    _assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _assign_role(session, volunteer, campaign, "VOLUNTEER_VIEWER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/directory-users?search=volunteer",
        headers=_auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert [item["display_name"] for item in payload] == ["Volunteer Candidate"]
    assert payload[0]["assigned_role_keys"] == ["VOLUNTEER_VIEWER"]
    assert payload[0]["inactive_role_keys"] == []


def test_put_milestones_replaces_campaign_milestones(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = _seed_user(session)
    campaign = _seed_campaign(session)
    _assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.put(
        f"/api/v1/campaigns/{campaign_id}/milestones",
        json={
            "milestones": [
                {"milestone_key": "registration_open", "occurs_on": "2026-09-01", "sort_order": 1},
                {"milestone_key": "pickup_start", "occurs_on": "2026-12-20", "sort_order": 2},
            ]
        },
        headers=_auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert [item["milestone_key"] for item in payload] == ["registration_open", "pickup_start"]


def test_create_template_and_schedule_then_readiness_reflects_changes(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = _seed_user(session)
    campaign = _seed_campaign(session)
    _assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    template_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/communications/templates",
        json={
            "template_key": "volunteer_welcome",
            "name": "Volunteer Welcome",
            "audience": "VOLUNTEER",
            "channel": "EMAIL",
            "subject_template": "Welcome",
            "body_template": "Thanks for helping.",
        },
        headers=_auth_header(manager_id, "VOLUNTEER"),
    )
    template_id = template_response.get_json()["id"]

    schedule_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/communications/schedules",
        json={
            "template_id": template_id,
            "milestone_key": "registration_open",
            "status": "DRAFT",
        },
        headers=_auth_header(manager_id, "VOLUNTEER"),
    )

    readiness_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/readiness",
        headers=_auth_header(manager_id, "VOLUNTEER"),
    )

    assert template_response.status_code == 201
    assert schedule_response.status_code == 201
    assert readiness_response.status_code == 200
    readiness = readiness_response.get_json()
    assert "missing_templates" not in {item["code"] for item in readiness["items"]}
    assert "missing_schedules" not in {item["code"] for item in readiness["items"]}
