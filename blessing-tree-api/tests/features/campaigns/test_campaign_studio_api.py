from __future__ import annotations

import uuid
from datetime import date, datetime

import pytest
from flask import Flask
from app.features.campaigns import api as campaign_api_module
from app.features.campaigns import studio_api as campaign_studio_api_module
from app.features.campaigns.calendar_intelligence_service import CampaignCalendarIntelligenceService
from app.features.admin.llm_runtime_service import LlmRuntimeUnavailableError
from app.models.admin_llm_configuration import AdminLlmConfiguration
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_communication_send import CampaignCommunicationSend
from app.models.campaign_communication_send_recipient import CampaignCommunicationSendRecipient
from app.models.campaign_event import CampaignEvent
from app.models.campaign_gift_policy import CampaignGiftPolicy
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign_milestone_definition import CampaignMilestoneDefinition
from app.models.communication_template import CommunicationTemplate
from app.models.sponsor import Sponsor
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsorship import Sponsorship
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
    sponsor = Sponsor(
        id=uuid.uuid4(),
        display_name="Taylor Sponsor",
        email="taylor@example.test",
        preferred_contact="EMAIL",
        source="STAFF_ENTRY",
        is_active=True,
    )
    session.add(sponsor)
    session.add(
        Sponsorship(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            sponsor_id=sponsor.id,
            status="ACTIVE",
            interest_status="COMMITTED",
            drop_off_status="NOT_STARTED",
        )
    )
    send = CampaignCommunicationSend(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        target_mode="CONTEXT_SPONSOR",
        status="SENT",
        subject="Reminder",
        recipient_count=1,
        delivered_count=1,
        failed_count=0,
        created_by_user_id=manager.id,
    )
    session.add(send)
    session.flush()
    session.add(
        CampaignCommunicationSendRecipient(
            id=uuid.uuid4(),
            send_id=send.id,
            recipient_type="SPONSOR",
            recipient_ref_id=sponsor.id,
            email="taylor@example.test",
            display_name="Taylor Sponsor",
            status="SENT",
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
    sponsor_summary = next(
        summary
        for summary in payload["communications"]["audience_recipient_summaries"]
        if summary["audience"] == "SPONSOR"
    )
    assert sponsor_summary["count"] == 1
    assert sponsor_summary["sample_recipients"][0]["email"] == "taylor@example.test"
    assert payload["communications"]["templates"][0]["template_key"] == "sponsor_reminder"
    assert payload["communications"]["schedules"][0]["status"] == "SCHEDULED"
    assert payload["communications"]["sends"][0]["target_mode"] == "CONTEXT_SPONSOR"
    assert payload["communications"]["sends"][0]["delivered_count"] == 1
    assert payload["communications"]["sends"][0]["recipients"][0]["email"] == "taylor@example.test"
    assert payload["communications"]["sends"][0]["recipients"][0]["recipient_type"] == "SPONSOR"
    assert payload["communications"]["recipient_options"]["sponsors"][0]["label"] == "Taylor Sponsor"
    assert payload["communications"]["recipient_options"]["sponsors"][0]["email"] == "taylor@example.test"
    assert payload["milestone_definitions"][0]["milestone_key"] == "registration_open"
    assert payload["milestones"][0]["milestone_key"] == "registration_open"
    assert payload["gift_policy"]["max_gifts_per_sponsor"] == 3
    assert payload["gift_policy"]["recipient_coverage_rule"] == "ALL_GIFTS_SPONSORED"
    assert payload["readiness"]["status"] == "NEEDS_ATTENTION"
    assert payload["readiness"]["overall_status"] == "NEEDS_ATTENTION"
    assert payload["readiness"]["phase_status"]["activate"] == "NEEDS_ATTENTION"
    assert "planning_gaps" in payload["readiness"]["groups"]
    assert "launch_checks" in payload["readiness"]["groups"]
    assert payload["readiness"]["items"][0]["action_label"].startswith("Open ")


def test_get_calendar_intelligence_returns_critical_dates_and_operational_groups(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    monkeypatch.setattr(
        campaign_studio_api_module,
        "_calendar_intelligence_service",
        CampaignCalendarIntelligenceService(today_provider=lambda: date(2026, 11, 15)),
    )
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Calendar Manager")
    campaign = seed_campaign(session)
    campaign.public_sponsor_signup_enabled = True
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_key="gift_due",
        name="Gift Due Reminder",
        audience="SPONSOR",
        channel="EMAIL",
        subject_template="Gift Due",
        body_template="Please bring your gifts.",
        is_active=True,
        created_by_user_id=manager.id,
    )
    milestone = CampaignMilestone(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        milestone_key="gift_turn_in_due",
        label="Gift Turn-In Due",
        occurs_on=date(2026, 11, 14),
        sort_order=1,
    )
    manual_event = CampaignEvent(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        title="Wrapping Day",
        event_type="GIFT",
        start_at=datetime(2026, 11, 20, 9, 0),
        end_at=None,
        all_day=False,
        source_type="manual",
        created_by_user_id=manager.id,
    )
    sponsor = Sponsor(
        id=uuid.uuid4(),
        display_name="Taylor Sponsor",
        email="taylor@example.test",
        preferred_contact="EMAIL",
        source="STAFF_ENTRY",
        is_active=True,
    )
    session.add_all([template, milestone, manual_event, sponsor])
    session.flush()
    session.add(
        CampaignCommunicationSchedule(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            template_id=template.id,
            milestone_key="gift_turn_in_due",
            status="SCHEDULED",
        )
    )
    session.add(
        Sponsorship(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            sponsor_id=sponsor.id,
            status="ACTIVE",
            interest_status="COMMITTED",
            drop_off_status="NOT_STARTED",
            drop_off_due_at=datetime(2026, 11, 13, 17, 0),
        )
    )
    session.add(
        SponsorInteraction(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            sponsor_id=sponsor.id,
            channel="CALL",
            direction="OUTBOUND",
            subject="Reminder call",
            outcome="LEFT_VM",
            occurred_at=datetime(2026, 11, 12, 10, 0),
            follow_up_at=datetime(2026, 11, 16, 9, 0),
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/calendar-intelligence",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["campaign_id"] == campaign_id
    assert payload["summary"]["scheduled_communications_count"] == 1
    assert payload["summary"]["overdue_count"] >= 2
    assert any(item["key"] == "gift_turn_in_due" and item["status"] == "overdue" for item in payload["critical_dates"])
    assert any(item["item_type"] == "sponsor_dropoff" and item["count"] == 1 for item in payload["items"])
    assert any(item["item_type"] == "sponsor_followup" and item["urgency"] == "due_soon" for item in payload["items"])
    assert any(item["item_type"] == "missing_date" and item["is_blocker"] for item in payload["items"])
    needs_attention = next(group for group in payload["agenda_groups"] if group["key"] == "needs_attention")
    assert needs_attention["items"]


def test_calendar_intelligence_requires_campaign_view(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Calendar Manager")
    outsider = seed_user(session, name="Outside User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    outsider_id = str(outsider.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/calendar-intelligence",
        headers=auth_header(outsider_id, "VOLUNTEER"),
    )

    assert response.status_code == 403


def test_patch_gift_policy_updates_campaign_rules(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
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
    response = client.patch(
        f"/api/v1/campaigns/{campaign_id}/gift-policy",
        json={
            "max_gifts_per_sponsor": 2,
            "max_wishlist_items_per_recipient": 4,
            "recipient_coverage_rule": "MIN_GIFTS_SPONSORED",
            "recipient_coverage_required_count": 2,
            "reservation_hold_minutes": 720,
            "allow_partial_sponsor_commitments": True,
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["max_gifts_per_sponsor"] == 2
    assert payload["max_wishlist_items_per_recipient"] == 4
    assert payload["recipient_coverage_rule"] == "MIN_GIFTS_SPONSORED"
    assert payload["recipient_coverage_required_count"] == 2
    assert payload["reservation_hold_minutes"] == 720
    assert payload["allow_partial_sponsor_commitments"] is True

    with campaign_api_module.SessionLocal() as verify_session:
        policy = (
            verify_session.query(CampaignGiftPolicy)
            .filter(CampaignGiftPolicy.campaign_id == uuid.UUID(campaign_id))
            .one()
        )
        assert policy.max_gifts_per_sponsor == 2


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
        json={"user_id": volunteer_id, "role_key": "CAMPAIGN_VIEWER"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["role_key"] == "CAMPAIGN_VIEWER"
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


def test_post_template_test_email_renders_and_sends_to_requested_address(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    sent_messages: list[dict[str, object]] = []

    def _fake_send_email_message(*, recipients, subject, html, text_body=None) -> None:
        sent_messages.append(
            {
                "recipients": recipients,
                "subject": subject,
                "html": html,
                "text_body": text_body,
            }
        )

    monkeypatch.setattr(
        "app.features.campaigns.studio_service.send_email_message",
        _fake_send_email_message,
    )
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session, name="Christmas Giving")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_key="sponsor_test",
        name="Sponsor Test",
        audience="SPONSOR",
        channel="EMAIL",
        subject_template="Hello {{sponsor.first_name}} for {{campaign.name}}",
        body_template="Dear {{sponsor.full_name}},\n\nPickup is {{milestone.date}}.",
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
        f"/api/v1/campaigns/{campaign_id}/communications/templates/{template_id}/test-email",
        json={"recipient_email": "reviewer@example.com"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["recipient_email"] == "reviewer@example.com"
    assert payload["subject"] == "[Test] Hello Taylor for Christmas Giving"
    assert len(sent_messages) == 1
    assert sent_messages[0]["recipients"] == ["reviewer@example.com"]
    assert "Taylor Reed" in sent_messages[0]["html"]
    assert "December 19, 2026" in sent_messages[0]["text_body"]


def test_put_milestones_accepts_active_configured_milestone_definition(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignMilestoneDefinition(
            id=uuid.uuid4(),
            milestone_key="custom_sponsor_check",
            label="Custom Sponsor Check",
            feature_area="SPONSORS",
            default_sort_order=42,
            is_active=True,
            is_system=False,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.put(
        f"/api/v1/campaigns/{campaign_id}/milestones",
        json={
            "milestones": [
                {
                    "milestone_key": "custom_sponsor_check",
                    "occurs_on": "2026-10-15",
                },
            ]
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload[0]["milestone_key"] == "custom_sponsor_check"
    assert payload[0]["label"] == "Custom Sponsor Check"
    assert payload[0]["sort_order"] == 42

    studio_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/studio",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert studio_response.status_code == 200
    studio_payload = studio_response.get_json()
    custom_definition = next(
        definition
        for definition in studio_payload["milestone_definitions"]
        if definition["milestone_key"] == "custom_sponsor_check"
    )
    assert custom_definition["label"] == "Custom Sponsor Check"
    assert custom_definition["default_sort_order"] == 42


def test_put_milestones_rejects_inactive_configured_milestone_definition(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignMilestoneDefinition(
            id=uuid.uuid4(),
            milestone_key="retired_gate",
            label="Retired Gate",
            feature_area="GENERAL",
            default_sort_order=42,
            is_active=False,
            is_system=False,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.put(
        f"/api/v1/campaigns/{campaign_id}/milestones",
        json={
            "milestones": [
                {
                    "milestone_key": "retired_gate",
                    "occurs_on": "2026-10-15",
                },
            ]
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 400
    assert response.get_json()["details"]["field"] == "milestone_key"


def test_put_milestones_preserves_existing_inactive_configured_milestone(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignMilestoneDefinition(
            id=uuid.uuid4(),
            milestone_key="retired_gate_with_date",
            label="Retired Gate With Date",
            feature_area="GENERAL",
            default_sort_order=42,
            is_active=False,
            is_system=False,
        )
    )
    session.add(
        CampaignMilestone(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            milestone_key="retired_gate_with_date",
            label="Retired Gate With Date",
            occurs_on=date(2026, 10, 15),
            sort_order=42,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.put(
        f"/api/v1/campaigns/{campaign_id}/milestones",
        json={"milestones": []},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    session = campaign_api_module.SessionLocal()
    retained = (
        session.query(CampaignMilestone)
        .filter(
            CampaignMilestone.campaign_id == uuid.UUID(campaign_id),
            CampaignMilestone.milestone_key == "retired_gate_with_date",
        )
        .one_or_none()
    )
    assert retained is not None
    assert retained.occurs_on == date(2026, 10, 15)
    session.close()


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
            "audience": "ORGANIZATION_CONTACT",
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
        "This drafts a planned calendar communication. Scheduled delivery depends on the campaign automation worker and beat process."
    ]
    assert payload["actions"][0]["payload"] == {
        "template_id": template_id,
        "milestone_key": None,
        "scheduled_for": "2026-11-08T09:00",
        "status": "SCHEDULED",
        "notes": "Schedule Volunteer Reminder on 2026-11-08 at 9am",
    }


def test_post_ai_draft_uses_configured_milestone_catalog(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignMilestoneDefinition(
            id=uuid.uuid4(),
            milestone_key="custom_sponsor_check",
            label="Custom Sponsor Check",
            feature_area="SPONSORS",
            default_sort_order=42,
            is_active=True,
            is_system=False,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "schedule",
            "requested_action_type": "milestone",
            "prompt": "Place Custom Sponsor Check on 2026-10-15",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["actions"][0]["action_type"] == "create_milestone"
    assert payload["actions"][0]["payload"] == {
        "milestone_key": "custom_sponsor_check",
        "label": "Custom Sponsor Check",
        "occurs_on": "2026-10-15",
        "notes": "Place Custom Sponsor Check on 2026-10-15",
        "sort_order": 42,
    }


def test_post_ai_readiness_draft_handles_configured_missing_milestone_rule(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.models.campaign_readiness_rule_definition import CampaignReadinessRuleDefinition

    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignMilestoneDefinition(
            id=uuid.uuid4(),
            milestone_key="custom_sponsor_check",
            label="Custom Sponsor Check",
            feature_area="SPONSORS",
            default_sort_order=42,
            is_active=True,
            is_system=False,
        )
    )
    session.add(
        CampaignReadinessRuleDefinition(
            id=uuid.uuid4(),
            rule_key="missing_custom_sponsor_check",
            name="Missing Custom Sponsor Check",
            rule_type="MISSING_MILESTONE",
            feature_area="SPONSORS",
            condition_type="ALWAYS",
            condition_config_json={},
            milestone_key="custom_sponsor_check",
            severity="warning",
            category="planning_gaps",
            blocking_for_json=[],
            section="schedule",
            action_label="Open Schedule",
            message="Custom sponsor check is missing.",
            is_active=True,
            is_system=False,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ai/draft",
        json={
            "section": "readiness",
            "prompt": "Fix readiness milestones",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    action = next(
        action
        for action in payload["actions"]
        if action["action_type"] == "create_milestone"
        and action["payload"]["milestone_key"] == "custom_sponsor_check"
    )
    assert action["payload"]["milestone_key"] == "custom_sponsor_check"
    assert action["payload"]["label"] == "Custom Sponsor Check"
    assert action["payload"]["sort_order"] == 42


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
        "This drafts a planned calendar communication. Scheduled delivery depends on the campaign automation worker and beat process."
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


def test_readiness_shows_each_missing_public_sponsor_milestone(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    campaign.public_sponsor_slug = "public-sponsor-readiness"
    campaign.public_sponsor_signup_enabled = True
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
    items_by_code = {item["code"]: item for item in readiness["items"]}
    expected_codes = {
        "missing_public_sponsor_registration_start",
        "missing_public_sponsor_registration_end",
        "missing_public_sponsor_gift_turn_in",
    }
    assert expected_codes <= set(items_by_code)
    assert "missing_required_milestone_gift_intake_end" not in items_by_code
    assert "start milestone is missing" in items_by_code["missing_public_sponsor_registration_start"]["message"]
    assert "end milestone is missing" in items_by_code["missing_public_sponsor_registration_end"]["message"]
    assert "gift turn-in deadline milestone is missing" in items_by_code["missing_public_sponsor_gift_turn_in"]["message"]
    for code in expected_codes:
        assert items_by_code[code]["category"] == "blockers"
        assert items_by_code[code]["action_label"] == "Open Schedule"
        assert items_by_code[code]["blocking_for"] == ["activate", "operations"]


def test_readiness_uses_configured_missing_milestone_rules(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.models.campaign_milestone_definition import CampaignMilestoneDefinition
    from app.models.campaign_readiness_rule_definition import CampaignReadinessRuleDefinition

    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session)
    campaign = seed_campaign(session)
    campaign.public_sponsor_slug = "dynamic-sponsor-readiness"
    campaign.public_sponsor_signup_enabled = True
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignMilestoneDefinition(
            id=uuid.uuid4(),
            milestone_key="dynamic_sponsor_gate",
            label="Dynamic Sponsor Gate",
            feature_area="SPONSORS",
            default_sort_order=99,
            is_active=True,
            is_system=False,
        )
    )
    session.add(
        CampaignReadinessRuleDefinition(
            id=uuid.uuid4(),
            rule_key="missing_dynamic_sponsor_gate",
            name="Missing Dynamic Sponsor Gate",
            rule_type="MISSING_MILESTONE",
            feature_area="SPONSORS",
            condition_type="CAMPAIGN_FIELD_TRUE",
            condition_config_json={"field": "public_sponsor_signup_enabled"},
            milestone_key="dynamic_sponsor_gate",
            severity="error",
            category="blockers",
            blocking_for_json=["activate", "operations"],
            section="schedule",
            action_label="Open Schedule",
            message="Dynamic sponsor gate is missing.",
            is_active=True,
            is_system=False,
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
    readiness = response.get_json()
    item = next(item for item in readiness["items"] if item["code"] == "missing_dynamic_sponsor_gate")
    assert item["message"] == "Dynamic sponsor gate is missing."
    assert item["category"] == "blockers"
    assert item["blocking_for"] == ["activate", "operations"]

    session = campaign_api_module.SessionLocal()
    session.add(
        CampaignMilestone(
            id=uuid.uuid4(),
            campaign_id=uuid.UUID(campaign_id),
            milestone_key="dynamic_sponsor_gate",
            label="Dynamic Sponsor Gate",
            occurs_on=date(2026, 10, 15),
            sort_order=99,
        )
    )
    session.commit()
    session.close()

    resolved_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/readiness",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert resolved_response.status_code == 200
    resolved_codes = {item["code"] for item in resolved_response.get_json()["items"]}
    assert "missing_dynamic_sponsor_gate" not in resolved_codes
