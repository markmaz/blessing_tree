from __future__ import annotations

import uuid
from datetime import date

import pytest
from flask import Flask
from app.features.campaigns import api as campaign_api_module
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate
from tests.features.campaigns.studio_test_support import (
    assign_role,
    auth_header,
    install_auth,
    seed_campaign,
    seed_user,
)

pytest_plugins = ("tests.features.campaigns.studio_test_support",)


def test_get_campaign_studio_returns_aggregate_payload(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
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
        headers=auth_header(manager_id, "VOLUNTEER"),
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
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    volunteer = seed_user(session, name="Volunteer User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    volunteer_id = str(volunteer.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/assignments",
        json={"user_id": volunteer_id, "role_key": "VOLUNTEER_VIEWER"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["role_key"] == "VOLUNTEER_VIEWER"
    assert payload["user"]["display_name"] == "Volunteer User"


def test_get_directory_users_returns_matching_active_users_with_assignment_context(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    volunteer = seed_user(session, name="Volunteer Candidate")
    seed_user(session, name="Different Person")
    inactive = seed_user(session, name="Inactive Volunteer")
    inactive.is_active = False
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    assign_role(session, volunteer, campaign, "VOLUNTEER_VIEWER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/directory-users?search=volunteer",
        headers=auth_header(manager_id, "VOLUNTEER"),
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
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
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
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert [item["milestone_key"] for item in payload] == ["registration_open", "pickup_start"]


def test_create_template_and_schedule_then_readiness_reflects_changes(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
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
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    template_id = template_response.get_json()["id"]

    schedule_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/communications/schedules",
        json={
            "template_id": template_id,
            "milestone_key": "registration_open",
            "status": "DRAFT",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    readiness_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/readiness",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert template_response.status_code == 201
    assert schedule_response.status_code == 201
    assert readiness_response.status_code == 200
    readiness = readiness_response.get_json()
    assert "missing_templates" not in {item["code"] for item in readiness["items"]}
    assert "missing_schedules" not in {item["code"] for item in readiness["items"]}
