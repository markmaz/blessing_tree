from __future__ import annotations

import uuid
from datetime import date, datetime

from flask import Flask

from app.features.campaigns import api as campaign_api_module
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_event import CampaignEvent
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


def test_post_event_creates_manual_campaign_event(
    app: Flask,
    monkeypatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/events",
        json={
            "title": "Volunteer Orientation",
            "event_type": "VOLUNTEER",
            "start_at": "2026-11-10T18:00:00",
            "end_at": "2026-11-10T19:30:00",
            "all_day": False,
            "notes": "Walk the team through intake.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["title"] == "Volunteer Orientation"
    assert payload["event_type"] == "VOLUNTEER"
    assert payload["source_type"] == "manual"
    assert payload["created_by_user_id"] == manager_id


def test_get_events_lists_manual_campaign_events(
    app: Flask,
    monkeypatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignEvent(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Sorting Day",
            event_type="GIFT",
            start_at=datetime(2026, 11, 18, 9, 0, 0),
            end_at=datetime(2026, 11, 18, 12, 0, 0),
            all_day=False,
            notes="Prepare intake tables.",
            source_type="manual",
            source_id=None,
            created_by_user_id=manager.id,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/events",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload) == 1
    assert payload[0]["title"] == "Sorting Day"
    assert payload[0]["source_type"] == "manual"


def test_get_schedule_returns_unified_manual_milestone_and_communication_items(
    app: Flask,
    monkeypatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        template_key="pickup_reminder",
        name="Pickup Reminder",
        audience="FAMILY",
        channel="EMAIL",
        subject_template="Pickup Reminder",
        body_template="Remember your pickup window.",
        is_active=True,
        created_by_user_id=manager.id,
    )
    milestone = CampaignMilestone(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        milestone_key="pickup_start",
        label="Pickup Window Opens",
        occurs_on=date(2026, 12, 20),
        sort_order=1,
    )
    manual_event = CampaignEvent(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        title="Volunteer Orientation",
        event_type="VOLUNTEER",
        start_at=datetime(2026, 11, 10, 18, 0, 0),
        end_at=datetime(2026, 11, 10, 19, 30, 0),
        all_day=False,
        notes="Run pickup training.",
        source_type="manual",
        source_id=None,
        created_by_user_id=manager.id,
    )
    session.add_all([template, milestone, manual_event])
    session.flush()
    session.add(
        CampaignCommunicationSchedule(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            template_id=template.id,
            milestone_key="pickup_start",
            status="SCHEDULED",
            notes="Send two days before doors open.",
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/schedule",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["campaign_id"] == campaign_id
    assert [item["source_type"] for item in payload["items"]] == [
        "manual",
        "milestone",
        "communication",
    ]
    assert payload["items"][1]["all_day"] is True
    assert payload["items"][2]["title"] == "Pickup Reminder"
    assert payload["items"][2]["is_editable"] is False


def test_patch_and_delete_event_manage_manual_campaign_event(
    app: Flask,
    monkeypatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    event = CampaignEvent(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        title="Old Title",
        event_type="GENERAL",
        start_at=datetime(2026, 11, 8, 12, 0, 0),
        end_at=None,
        all_day=False,
        notes=None,
        source_type="manual",
        source_id=None,
        created_by_user_id=manager.id,
    )
    session.add(event)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    event_id = str(event.id)
    session.commit()
    session.close()

    client = app.test_client()
    patch_response = client.patch(
        f"/api/v1/campaigns/{campaign_id}/events/{event_id}",
        json={
            "title": "Updated Title",
            "event_type": "PICKUP",
            "all_day": True,
            "notes": "Now an all-day pickup coordination block.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert patch_response.status_code == 200
    patch_payload = patch_response.get_json()
    assert patch_payload["title"] == "Updated Title"
    assert patch_payload["event_type"] == "PICKUP"
    assert patch_payload["all_day"] is True

    delete_response = client.delete(
        f"/api/v1/campaigns/{campaign_id}/events/{event_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert delete_response.status_code == 204

    list_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/events",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert list_response.status_code == 200
    assert list_response.get_json() == []
