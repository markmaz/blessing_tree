from __future__ import annotations

import uuid
from datetime import date, datetime

import pytest
from flask import Flask
from app.features.campaigns import api as campaign_api_module
from app.features.campaigns import studio_api as campaign_studio_api_module
from app.features.admin.llm_runtime_service import LlmRuntimeUnavailableError
from app.models.admin_llm_configuration import AdminLlmConfiguration
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


def seed_llm_config(session) -> None:
    session.add(
        AdminLlmConfiguration(
            id=uuid.uuid4(),
            provider="OPENAI_COMPATIBLE",
            label="Primary LLM",
            base_url="https://llm.example.test/v1",
            model="gpt-4o-mini",
            api_key_encrypted=None,
            is_enabled=True,
        )
    )
    session.flush()


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
        campaign_id=campaign.id,
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
    assert payload["communications"]["audience_catalog"][0]["key"] == "HOUSEHOLD_CONTACT"
    assert payload["communications"]["templates"][0]["template_key"] == "sponsor_reminder"
    assert payload["communications"]["schedules"][0]["status"] == "SCHEDULED"
    assert payload["milestones"][0]["milestone_key"] == "registration_open"
    assert payload["readiness"]["status"] == "NEEDS_ATTENTION"
    assert payload["readiness"]["overall_status"] == "NEEDS_ATTENTION"
    assert payload["readiness"]["phase_status"]["activate"] == "NEEDS_ATTENTION"
    assert "planning_gaps" in payload["readiness"]["groups"]
    assert "launch_checks" in payload["readiness"]["groups"]
    assert payload["readiness"]["items"][0]["action_label"].startswith("Open ")


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
    monkeypatch.setattr(
        "app.features.campaigns.automation_readiness_service.campaign_worker_is_healthy",
        lambda: False,
    )
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
    readiness_codes = {item["code"] for item in readiness["items"]}
    assert "missing_templates" not in readiness_codes
    assert "missing_schedules" not in readiness_codes
    assert "automation_worker_unavailable" in readiness_codes
    automation_item = next(
        item
        for item in readiness["items"]
        if item["code"] == "automation_worker_unavailable"
    )
    assert automation_item["category"] == "operational_health"
    assert automation_item["action_label"] == "Open Readiness"
    assert automation_item["blocking_for"] == ["operations"]


def test_create_template_accepts_recipient_aware_audience_key(
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
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/communications/templates",
        json={
            "template_key": "facility_outreach",
            "name": "Facility Outreach",
            "audience": "ADULT_PROGRAM_CONTACT",
            "channel": "EMAIL",
            "subject_template": "Facility update",
            "body_template": "Hello {{contact.first_name}}.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["audience"] == "ORGANIZATION_CONTACT"


def test_delete_template_removes_unscheduled_template(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_key="volunteer_follow_up",
        name="Volunteer Follow Up",
        audience="VOLUNTEER",
        channel="EMAIL",
        subject_template="Thanks",
        body_template="Thanks for helping.",
        is_active=True,
        created_by_user_id=manager.id,
    )
    session.add(template)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    template_id = str(template.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.delete(
        f"/api/v1/campaigns/{campaign_id}/communications/templates/{template_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 204

    session = campaign_api_module.SessionLocal()
    assert session.get(CommunicationTemplate, uuid.UUID(template_id)) is None
    session.close()


def test_delete_template_rejects_scheduled_template(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_key="volunteer_follow_up",
        name="Volunteer Follow Up",
        audience="VOLUNTEER",
        channel="EMAIL",
        subject_template="Thanks",
        body_template="Thanks for helping.",
        is_active=True,
        created_by_user_id=manager.id,
    )
    session.add(template)
    session.flush()
    session.add(
        CampaignCommunicationSchedule(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            template_id=template.id,
            milestone_key="registration_open",
            status="DRAFT",
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    template_id = str(template.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.delete(
        f"/api/v1/campaigns/{campaign_id}/communications/templates/{template_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 409
    assert response.get_json()["error"] == "Template is still used by scheduled communications"


def test_post_ai_draft_returns_schedule_event_action(
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
    campaign_name = campaign.name
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "schedule",
            "prompt": "Add volunteer orientation on 2026-11-03 at 6pm",
            "requested_action_type": "event",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["message"] == f"I drafted 1 schedule action for {campaign_name}."
    assert payload["actions"][0]["action_type"] == "create_event"
    assert payload["actions"][0]["payload"] == {
        "title": "Volunteer Orientation",
        "event_type": "VOLUNTEER",
        "start_at": "2026-11-03T18:00",
        "end_at": None,
        "all_day": False,
        "notes": "Add volunteer orientation on 2026-11-03 at 6pm",
    }


def test_post_ai_draft_uses_configured_llm_when_available(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    seed_llm_config(session)
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    monkeypatch.setattr(
        campaign_studio_api_module._ai_draft_service.llm_drafts.runtime,
        "_request_json",
        lambda *args, **kwargs: {
            "message": "Drafted with configured LLM.",
            "assumptions": ["Used the configured LLM for richer email drafting."],
            "warnings": [],
            "actions": [
                {
                    "action_type": "create_template",
                    "payload": {
                        "name": "Volunteer Welcome",
                        "audience": "VOLUNTEER",
                        "subject_template": "Welcome to {{campaign.name}}",
                        "body_template": "Hello {{member.display_name}},\\n\\nThank you for volunteering.",
                    },
                },
                {
                    "action_type": "create_communication_schedule",
                    "payload": {
                        "template_name": "Volunteer Welcome",
                        "milestone_key": "registration_open",
                        "status": "DRAFT",
                    },
                },
            ],
        },
    )

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "communications",
            "prompt": "Create a volunteer welcome template and place it on registration open",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["message"] == "Drafted with configured LLM."
    assert payload["actions"][0]["payload"]["body_template"].startswith("Hello {{member.display_name}}")
    assert payload["actions"][1]["payload"]["template_ref"] == payload["actions"][0]["payload"]["template_ref"]
    assert payload["assumptions"] == ["Used the configured LLM for richer email drafting."]


def test_post_ai_draft_repairs_common_llm_template_field_aliases(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    seed_llm_config(session)
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    monkeypatch.setattr(
        campaign_studio_api_module._ai_draft_service.llm_drafts.runtime,
        "_request_json",
        lambda *args, **kwargs: {
            "message": "Drafted with configured LLM.",
            "assumptions": [],
            "warnings": [],
            "actions": [
                {
                    "action_type": "create_template",
                    "payload": {
                        "name": "Volunteer Welcome",
                        "audience": "VOLUNTEER",
                        "subject": "Welcome to {{campaign.name}}",
                        "body": "Hello {{member.display_name}}, thanks for helping.",
                    },
                },
            ],
        },
    )

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "communications",
            "prompt": "Create a volunteer welcome template",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["message"] == "Drafted with configured LLM."
    assert payload["warnings"] == []
    assert payload["actions"][0]["action_type"] == "create_template"
    assert payload["actions"][0]["payload"]["subject_template"] == "Welcome to {{campaign.name}}"
    assert payload["actions"][0]["payload"]["body_template"] == "Hello {{member.display_name}}, thanks for helping."


def test_post_ai_draft_falls_back_when_configured_llm_fails(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    seed_llm_config(session)
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    monkeypatch.setattr(
        campaign_studio_api_module._ai_draft_service.llm_drafts.runtime,
        "_request_json",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            LlmRuntimeUnavailableError("Configured LLM request failed: timeout")
        ),
    )

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "settings",
            "prompt": "Set the campaign dates from 2026-11-10 to 2026-12-20 and add a description.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["actions"][0]["action_type"] == "update_campaign_settings"
    assert payload["warnings"][0] == "Configured LLM request failed: timeout"


def test_post_ai_draft_returns_schedule_communication_action_with_warning(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_key="volunteer_reminder",
        name="Volunteer Reminder",
        audience="VOLUNTEER",
        channel="EMAIL",
        subject_template="Reminder",
        body_template="Please join us.",
        is_active=True,
        created_by_user_id=manager.id,
    )
    session.add(template)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    template_id = str(template.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "schedule",
            "prompt": "Schedule Volunteer Reminder on 2026-11-08 at 9am",
            "requested_action_type": "communication",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["actions"][0]["action_type"] == "create_communication_schedule"
    assert payload["warnings"] == [
        "This drafts a planned calendar communication only. Automated delivery is not wired yet."
    ]
    assert payload["actions"][0]["payload"] == {
        "template_id": template_id,
        "milestone_key": None,
        "scheduled_for": "2026-11-08T09:00",
        "status": "SCHEDULED",
        "notes": "Schedule Volunteer Reminder on 2026-11-08 at 9am",
    }


def test_post_ai_draft_returns_communications_template_and_schedule_bundle(
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
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "communications",
            "prompt": "Create a volunteer welcome template and place it on registration open",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["message"] == "I drafted 2 communications actions for Studio Campaign."
    assert [action["action_type"] for action in payload["actions"]] == [
        "create_template",
        "create_communication_schedule",
    ]
    assert payload["actions"][0]["payload"]["audience"] == "VOLUNTEER"
    assert payload["actions"][0]["payload"]["template_ref"]
    assert payload["actions"][0]["payload"]["subject_template"] == "Welcome to {{campaign.name}}"
    assert payload["actions"][1]["payload"]["template_id"] is None
    assert (
        payload["actions"][1]["payload"]["template_ref"]
        == payload["actions"][0]["payload"]["template_ref"]
    )
    assert payload["actions"][1]["payload"]["milestone_key"] == "registration_open"
    assert payload["warnings"] == [
        "This drafts a planned calendar communication only. Automated delivery is not wired yet."
    ]


def test_post_ai_draft_returns_advisory_response_for_team_section(
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
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "team",
            "prompt": "Explain the difference between app access roles and team roles.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["actions"] == []
    assert "Campaign AI can explain roster concepts here" in payload["message"]


def test_post_ai_draft_returns_team_bundle_actions(
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
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "team",
            "prompt": "Set up a Warehouse Crew team with Lead, Runner, and Check-In roles and add Chris Walker to Warehouse Crew as Check-In",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["message"] == "I drafted 6 team actions for Studio Campaign."
    assert [action["action_type"] for action in payload["actions"]] == [
        "create_team",
        "create_team_role",
        "create_team_role",
        "create_team_role",
        "create_member",
        "assign_member_to_team",
    ]
    assert payload["actions"][0]["payload"]["name"] == "Warehouse Crew"
    assert payload["actions"][1]["payload"]["team_ref"] == payload["actions"][0]["payload"]["team_ref"]
    assert payload["actions"][4]["payload"]["display_name"] == "Chris Walker"
    assert payload["actions"][5]["payload"]["member_ref"] == payload["actions"][4]["payload"]["member_ref"]
    assert payload["actions"][5]["summary"] == "Assigns Chris Walker to Warehouse Crew as Check In."
    assert payload["actions"][5]["payload"]["team_role_ref"] == payload["actions"][3]["payload"]["role_ref"]


def test_post_ai_draft_returns_readiness_fix_bundle(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    campaign.description = None
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "readiness",
            "prompt": "Fix the activation blockers for me.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    action_types = [action["action_type"] for action in payload["actions"]]
    assert "create_milestone" in action_types
    assert "create_template" in action_types
    assert "resolve_readiness_gap" in action_types


def test_post_ai_draft_returns_settings_update_action(
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
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "settings",
            "prompt": "Set the campaign dates from 2026-11-10 to 2026-12-20 and add a description.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["message"] == "I drafted 1 settings action for Studio Campaign."
    assert payload["actions"][0]["action_type"] == "update_campaign_settings"
    assert payload["actions"][0]["payload"]["start_date"] == "2026-11-10"
    assert payload["actions"][0]["payload"]["end_date"] == "2026-12-20"
    assert payload["actions"][0]["payload"]["description"]


def test_post_ai_draft_returns_blocked_status_change_for_settings(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    campaign.status = "DRAFT"
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "settings",
            "prompt": "Activate this campaign.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["actions"][0]["action_type"] == "suggest_status_change"
    assert payload["actions"][0]["status"] == "blocked"
    assert payload["actions"][0]["payload"]["status"] == "ACTIVE"
    assert "activation" in payload["actions"][0]["warnings"][0].lower()


def test_delete_communication_schedule_removes_schedule(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_key="volunteer_reminder",
        name="Volunteer Reminder",
        audience="VOLUNTEER",
        channel="EMAIL",
        subject_template="Reminder",
        body_template="Show up on time.",
        is_active=True,
        created_by_user_id=manager.id,
    )
    session.add(template)
    session.flush()
    schedule = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        milestone_key="registration_open",
        status="SCHEDULED",
    )
    session.add(schedule)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    schedule_id = str(schedule.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.delete(
        f"/api/v1/campaigns/{campaign_id}/communications/schedules/{schedule_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 204
    session = campaign_api_module.SessionLocal()
    remaining = session.get(CampaignCommunicationSchedule, uuid.UUID(schedule_id))
    session.close()
    assert remaining is None


def test_readiness_flags_missing_manual_schedule_and_missing_schedule_messaging(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_key="volunteer_welcome",
        name="Volunteer Welcome",
        audience="VOLUNTEER",
        channel="EMAIL",
        subject_template="Welcome",
        body_template="Thanks for helping.",
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
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/readiness",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    readiness_codes = {item["code"] for item in response.get_json()["items"]}
    assert "missing_manual_schedule" in readiness_codes
    assert "missing_schedule_messaging" in readiness_codes


def test_readiness_clears_schedule_warnings_after_manual_event_and_milestone_schedule(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
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
    session.add(
        CampaignEvent(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Volunteer Orientation",
            event_type="VOLUNTEER",
            start_at=datetime(2026, 8, 15, 9, 0, 0),
            end_at=None,
            all_day=True,
            notes=None,
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
        f"/api/v1/campaigns/{campaign_id}/readiness",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    readiness_codes = {item["code"] for item in response.get_json()["items"]}
    assert "missing_manual_schedule" not in readiness_codes
    assert "missing_schedule_messaging" not in readiness_codes


def test_readiness_blocks_activation_when_date_range_is_missing(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    campaign.start_date = None
    campaign.end_date = None
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/readiness",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    readiness = response.get_json()
    assert readiness["status"] == "BLOCKED"
    assert readiness["phase_status"]["activate"] == "BLOCKED"
    assert readiness["phase_status"]["operations"] == "BLOCKED"
    item = next(item for item in readiness["items"] if item["code"] == "missing_date_range")
    assert item["category"] == "blockers"
    assert item["action_label"] == "Open Settings"
    assert item["blocking_for"] == ["activate", "operations"]
