from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from flask import Flask

from app.features.campaigns import api as campaign_api_module
from app.models.ask_prompt_log import AskPromptLog
from app.models.pending_sponsor_registration import PendingSponsorRegistration
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    RECIPIENT_AGE_UNIT_YEARS,
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
    WISHLIST_ITEM_TYPE_CLOTHING,
    WISHLIST_STATUS_READY,
)
from app.models.recipient_group import RecipientGroup
from app.models.sponsor_constants import PENDING_SPONSOR_REGISTRATION_STATUS_PENDING
from app.models.sponsor import Sponsor
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem
from tests.features.campaigns.studio_test_support import (
    assign_role,
    auth_header,
    install_auth,
    seed_campaign,
    seed_user,
)

pytest_plugins = ("tests.features.campaigns.studio_test_support",)


def test_ask_help_returns_direct_navigation_action(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "How do I add a sponsor?"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "app_help"
    assert payload["title"] == "Add a sponsor"
    assert payload["actions"][0]["route"] == f"/campaigns/{campaign_id}/sponsors/intake"


def test_ask_sponsor_email_prompt_returns_campaign_communications_help(
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

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "How do I create an email to send out to sponsors?"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "app_help"
    assert payload["title"] == "Create sponsor communications"
    assert "Communications" in payload["answer"]
    assert payload["actions"][0]["route"] == f"/campaigns/{campaign_id}/studio"


def test_ask_flyer_prompt_opens_flyer_builder(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Where do I print the sponsor flyer?"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "navigation_result"
    assert payload["title"] == "Flyer Builder"
    assert payload["actions"][0]["route"] == f"/campaigns/{campaign_id}/studio/sponsor-flyer"


def test_flyer_builder_api_creates_default_and_updates(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
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
    list_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/flyers",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert list_response.status_code == 200
    flyers = list_response.get_json()
    assert len(flyers) == 1
    assert flyers[0]["flyer_key"] == "sponsor_recruitment"

    flyer_id = flyers[0]["id"]
    update_response = client.patch(
        f"/api/v1/campaigns/{campaign_id}/flyers/{flyer_id}",
        json={
            "headline": "Sponsor Blessing Tree Gifts",
            "qr_target_type": "CUSTOM_URL",
            "qr_custom_url": "https://example.com/flyer",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert update_response.status_code == 200
    payload = update_response.get_json()
    assert payload["headline"] == "Sponsor Blessing Tree Gifts"
    assert payload["qr_target_type"] == "CUSTOM_URL"
    assert payload["qr_custom_url"] == "https://example.com/flyer"


def test_ask_logs_prompt_and_accepts_feedback(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    admin = seed_user(session, role="ADMIN", name="Admin User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    admin_id = str(admin.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    ask_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "How do I add a sponsor?"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert ask_response.status_code == 200
    ask_payload = ask_response.get_json()
    prompt_log_id = ask_payload["prompt_log_id"]
    session = campaign_api_module.SessionLocal()
    log = session.query(AskPromptLog).filter(AskPromptLog.id == uuid.UUID(prompt_log_id)).one()
    assert log.prompt == "How do I add a sponsor?"
    assert log.result_kind == "app_help"
    assert log.result_key == "add_sponsor"
    assert log.response_summary_json["answer"] == ask_payload["answer"]
    session.close()

    feedback_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ask/{prompt_log_id}/feedback",
        json={"rating": "negative", "comment": "Expected sponsor reports."},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert feedback_response.status_code == 200
    assert feedback_response.get_json()["feedback_rating"] == "NEGATIVE"
    session = campaign_api_module.SessionLocal()
    log = session.query(AskPromptLog).filter(AskPromptLog.id == uuid.UUID(prompt_log_id)).one()
    assert log.feedback_rating == "NEGATIVE"
    assert log.feedback_comment == "Expected sponsor reports."
    assert log.feedback_at is not None
    session.close()

    review_response = client.get(
        "/api/v1/admin/ask/review",
        headers=auth_header(admin_id, "ADMIN"),
    )

    assert review_response.status_code == 200
    review_payload = review_response.get_json()
    assert review_payload["logs"][0]["id"] == prompt_log_id
    assert review_payload["logs"][0]["feedback_rating"] == "NEGATIVE"

    reviewed_response = client.patch(
        f"/api/v1/admin/ask/review/{prompt_log_id}",
        json={"review_note": "Added alias candidate to backlog."},
        headers=auth_header(admin_id, "ADMIN"),
    )

    assert reviewed_response.status_code == 200
    reviewed_payload = reviewed_response.get_json()
    assert reviewed_payload["log"]["reviewed_at"] is not None
    assert reviewed_payload["log"]["review_note"] == "Added alias candidate to backlog."

    review_response = client.get(
        "/api/v1/admin/ask/review",
        headers=auth_header(admin_id, "ADMIN"),
    )
    assert review_response.status_code == 200
    assert review_response.get_json()["logs"] == []


def test_ask_report_lists_recipients_needing_sponsors(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_recipient_with_open_and_committed_gifts(session, campaign.id)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Show girls age 8 to 12 still needing sponsors"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "report_result"
    assert payload["report"]["metric_key"] == "recipients_needing_sponsors"
    assert payload["report"]["summary"]["value"] == 1
    assert payload["report"]["rows"][0]["recipient_name"] == "Ava Johnson"
    assert payload["interpreted_as"]["filters"]["gender"] == "F"
    assert payload["interpreted_as"]["filters"]["age_min"] == 8
    assert payload["interpreted_as"]["filters"]["age_max"] == 12


def test_campaign_summary_includes_dashboard_widgets(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_recipient_with_open_and_committed_gifts(session, campaign.id)
    session.add(
        AskPromptLog(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            user_id=manager.id,
            prompt="Show gift status.",
            result_kind="navigation_result",
            result_key="gift_status",
            confidence=0.92,
            response_summary_json={"title": "Gift Status"},
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().get(
        f"/api/v1/campaigns/{campaign_id}/summary",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    widgets = payload["widgets"]
    assert widgets["population"]["children"] == 1
    assert widgets["population"]["adults"] == 0
    assert widgets["population"]["gifts"] == 2
    assert widgets["population"]["unsponsored_gifts"] == 1
    assert widgets["unsponsored_gifts"]["count"] == 1
    assert widgets["unsponsored_gifts"]["items"][0]["gift"] == "Winter coat"
    assert widgets["sponsor_recipient_counts"][0]["sponsor_name"] == "Sponsor One"
    assert widgets["sponsor_recipient_counts"][0]["recipient_count"] == 1
    assert widgets["popular_gifts_by_gender"][0]["gender"] == "Female"
    assert widgets["continue_where_left_off"][0]["prompt"] == "Show gift status."


def test_ask_report_runs_dashboard_widget_queries(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_recipient_with_open_and_committed_gifts(session, campaign.id)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    popular_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Show top 5 gifts by gender"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert popular_response.status_code == 200
    popular_payload = popular_response.get_json()
    assert popular_payload["report"]["metric_key"] == "popular_gifts_by_gender"
    assert popular_payload["report"]["rows"][0]["gender"] == "Female"

    sponsor_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Show recipients sponsored by sponsor"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert sponsor_response.status_code == 200
    sponsor_payload = sponsor_response.get_json()
    assert sponsor_payload["report"]["metric_key"] == "recipients_sponsored_by_sponsor"
    assert sponsor_payload["report"]["rows"][0]["recipient_count"] == 1

    unsponsored_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "How many gifts are unsponsored?"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert unsponsored_response.status_code == 200
    unsponsored_payload = unsponsored_response.get_json()
    assert unsponsored_payload["report"]["metric_key"] == "unsponsored_gifts"
    assert unsponsored_payload["report"]["summary"]["value"] == 1


def test_ask_report_requires_report_capability(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    viewer = seed_user(session, name="Viewer User")
    campaign = seed_campaign(session)
    assign_role(session, viewer, campaign, "CAMPAIGN_VIEWER")
    viewer_id = str(viewer.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Show recipients still needing sponsors"},
        headers=auth_header(viewer_id, "VOLUNTEER"),
    )

    assert response.status_code == 403


def test_ask_report_lists_sponsors_with_unreceived_gifts(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_recipient_with_open_and_committed_gifts(session, campaign.id)
    sponsorship = session.query(Sponsorship).filter(Sponsorship.campaign_id == campaign.id).one()
    sponsorship.drop_off_due_at = datetime.utcnow() - timedelta(days=1)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Which sponsors have not turned in gifts?"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "report_result"
    assert payload["report"]["metric_key"] == "sponsors_with_unreceived_gifts"
    assert payload["report"]["summary"]["value"] == 1
    assert payload["report"]["rows"][0]["sponsor_name"] == "Sponsor One"
    assert payload["actions"][0]["route"] == f"/campaigns/{campaign_id}/sponsors/reports"


def test_ask_report_lists_overdue_sponsor_gifts(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_recipient_with_open_and_committed_gifts(session, campaign.id)
    sponsorship = session.query(Sponsorship).filter(Sponsorship.campaign_id == campaign.id).one()
    sponsorship.drop_off_due_at = datetime.utcnow() - timedelta(days=1)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "How many gifts are overdue?"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "report_result"
    assert payload["report"]["metric_key"] == "overdue_sponsor_gifts"
    assert payload["report"]["summary"]["value"] == 1
    assert payload["report"]["rows"][0]["unreceived_gift_count"] == 1


def test_ask_report_lists_pending_public_registrations(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        PendingSponsorRegistration(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            email="pending@example.com",
            first_name="Pending",
            last_name="Sponsor",
            preferred_contact="EMAIL",
            selected_wishlist_item_ids_json=[],
            verification_token="pending-public-token",
            expires_at=datetime.utcnow() + timedelta(hours=24),
            status=PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Show pending public sponsor registrations"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "report_result"
    assert payload["report"]["metric_key"] == "pending_public_sponsor_registrations"
    assert payload["report"]["summary"]["value"] == 1
    assert payload["report"]["rows"][0]["email"] == "pending@example.com"


def test_ask_report_lists_gift_exceptions(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_recipient_with_open_and_committed_gifts(session, campaign.id)
    item = session.query(WishlistItem).filter(WishlistItem.label_code == "ask-open-coat").one()
    item.status = "EXCEPTION"
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Show gifts with exceptions"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "report_result"
    assert payload["report"]["metric_key"] == "exception_gifts"
    assert payload["report"]["summary"]["value"] == 1
    assert payload["report"]["rows"][0]["gift"] == "Winter coat"


def test_ask_report_lists_recipients_not_fulfilled(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_recipient_with_open_and_committed_gifts(session, campaign.id)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    response = app.test_client().post(
        f"/api/v1/campaigns/{campaign_id}/ask",
        json={"prompt": "Show recipients not fulfilled"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["kind"] == "report_result"
    assert payload["report"]["metric_key"] == "recipients_not_fulfilled"
    assert payload["report"]["summary"]["value"] == 1
    assert payload["report"]["rows"][0]["remaining_count"] == 2


def _seed_recipient_with_open_and_committed_gifts(session, campaign_id):
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Johnson Family",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_CHILD,
        program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        display_label="Ava Johnson",
        age=8,
        age_unit=RECIPIENT_AGE_UNIT_YEARS,
        gender="F",
        status=RECIPIENT_STATUS_ACTIVE,
    )
    wishlist = Wishlist(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        recipient_id=recipient.id,
        wishlist_status=WISHLIST_STATUS_READY,
    )
    open_gift = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        category="Outerwear",
        item_type=WISHLIST_ITEM_TYPE_CLOTHING,
        description="Winter coat",
        qty_requested=1,
        priority="HIGH",
        allow_substitute=True,
        status="OPEN",
        qty_fulfilled=0,
        label_code="ask-open-coat",
        label_version=1,
    )
    committed_gift = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        category="Toy",
        item_type="GIFT",
        description="Building blocks",
        qty_requested=1,
        priority="MEDIUM",
        allow_substitute=True,
        status="COMMITTED",
        qty_fulfilled=0,
        label_code="ask-committed-blocks",
        label_version=1,
    )
    sponsor = Sponsor(
        id=uuid.uuid4(),
        display_name="Sponsor One",
        preferred_contact="EMAIL",
        is_active=True,
    )
    sponsorship = Sponsorship(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        sponsor_id=sponsor.id,
        status="ACTIVE",
    )
    sponsorship_item = SponsorshipItem(
        id=uuid.uuid4(),
        sponsorship_id=sponsorship.id,
        wishlist_item_id=committed_gift.id,
        qty_committed=1,
    )
    session.add_all([group, recipient, wishlist, open_gift, committed_gift, sponsor, sponsorship, sponsorship_item])
    session.flush()
