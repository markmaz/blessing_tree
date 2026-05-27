from __future__ import annotations

import uuid

import pytest
from flask import Flask

from app.features.campaigns import api as campaign_api_module
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
