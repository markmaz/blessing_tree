from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from app.features.campaigns import api as campaign_api_module
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.gifts.search_parser import parse_gift_search_text
from app.models.campaign_gift_policy import CampaignGiftPolicy
from app.models.campaign_gift_reminder_rule import CampaignGiftReminderRule
from app.models.audit_event import AuditEvent
from app.models.campaign_manual_gift_label import CampaignManualGiftLabel
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate
from app.models.donation_line import DonationLine
from app.models.fulfillment import Fulfillment
from app.models.item_event import ItemEvent
from app.models.label_print_item import LabelPrintItem
from app.models.label_print_job import LabelPrintJob
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
    WISHLIST_ITEM_TYPE_CLOTHING,
    WISHLIST_ITEM_TYPE_GIFT,
    WISHLIST_STATUS_READY,
)
from app.models.recipient_group import RecipientGroup
from app.models.scan_event import ScanEvent
from app.models.gift_reservation import GiftReservation
from app.models.sponsor import Sponsor
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsor_reminder import SponsorReminder
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


def test_parse_gift_search_text_extracts_core_filters() -> None:
    parsed = parse_gift_search_text("warm coat for a girl age 8 under $50 size youth medium")

    assert parsed.age_min == 8
    assert parsed.age_max == 8
    assert parsed.gender == "F"
    assert "coat" in parsed.categories
    assert "CLOTHING" in parsed.item_types
    assert parsed.max_cost_cents == 5000
    assert "youth medium" in parsed.sizes


def test_staff_gift_search_filters_natural_language(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Gift Search Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign.id}/gifts/search?q=girl age 8 coat&limit=20",
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["parsed_filters"]["age_min"] == 8
    assert payload["parsed_filters"]["gender"] == "F"
    descriptions = [item["description"] for item in payload["items"]]
    assert descriptions == ["Winter coat"]
    item = payload["items"][0]
    assert item["recipient"]["display_label"] == "Ava Johnson"
    assert item["recipient"]["program_recipient_id"] == "CH-001"
    assert item["label_code"] == "gift-search-coat"
    assert item["recipient_note"] == "Prefers blue or purple."


def test_public_gift_search_filters_and_hides_private_recipient_fields(app) -> None:
    session = campaign_api_module.SessionLocal()
    campaign = seed_campaign(session, name="Public Gift Search Campaign")
    campaign.public_sponsor_slug = "public-gift-search"
    campaign.public_sponsor_signup_enabled = True
    _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    response = client.get("/api/v1/public/campaigns/public-gift-search/gifts/search?q=girl age 8 coat")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["count"] == 1
    item = payload["items"][0]
    assert item["description"] == "Winter coat"
    assert item["is_available"] is True
    assert "label_code" not in item
    assert "recipient_note" not in item
    assert "notes" not in item
    assert item["recipient"] == {
        "id": item["recipient"]["id"],
        "public_label": "Child age 8",
        "recipient_kind": "CHILD",
        "program_type": "CHILD_FAMILY",
        "age": 8,
        "age_unit": "YEARS",
        "gender": "F",
    }
    assert "display_label" not in item["recipient"]
    assert "program_recipient_id" not in item["recipient"]


def test_staff_can_commit_and_release_gift(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Gift Commit Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    sponsor = session.query(Sponsor).filter(Sponsor.display_name == "Sponsor One").one()
    session.commit()

    client = app.test_client()
    commit_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['coat_id']}/commit",
        json={"sponsor_id": str(sponsor.id), "notes": "Staff matched this gift."},
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert commit_response.status_code == 201
    commit_payload = commit_response.get_json()
    assert commit_payload["gift"]["status"] == "COMMITTED"
    assert commit_payload["gift"]["sponsorship_status"] == "SPONSORED"
    assert session.query(SponsorshipItem).filter(SponsorshipItem.wishlist_item_id == gifts["coat_id"]).count() == 1
    assert session.query(GiftReservation).filter(GiftReservation.wishlist_item_id == gifts["coat_id"]).count() == 1
    commit_audit = (
        session.query(AuditEvent)
        .filter(AuditEvent.entity_id == gifts["coat_id"], AuditEvent.area == "gifts")
        .order_by(AuditEvent.occurred_at.desc())
        .first()
    )
    assert commit_audit is not None
    assert commit_audit.action == "status_changed"
    assert commit_audit.change_set_json[0]["field"] == "status"
    assert commit_audit.change_set_json[0]["before"] == "OPEN"
    assert commit_audit.change_set_json[0]["after"] == "COMMITTED"

    release_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['coat_id']}/release",
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert release_response.status_code == 200
    release_payload = release_response.get_json()
    assert release_payload["gift"]["status"] == "OPEN"
    assert release_payload["gift"]["sponsorship_status"] == "UNSPONSORED"
    assert session.query(SponsorshipItem).filter(SponsorshipItem.wishlist_item_id == gifts["coat_id"]).count() == 0


def test_staff_commit_enforces_campaign_sponsor_gift_limit(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Gift Limit Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    sponsor = session.query(Sponsor).filter(Sponsor.display_name == "Sponsor One").one()
    session.add(
        CampaignGiftPolicy(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            max_gifts_per_sponsor=1,
        )
    )
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['coat_id']}/commit",
        json={"sponsor_id": str(sponsor.id), "notes": "Would exceed limit."},
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 409
    assert "allows up to 1 gifts per sponsor" in response.get_json()["error"]


def test_public_registration_reserves_selected_gifts_after_verification(app, monkeypatch) -> None:
    captured_email: dict[str, str] = {}

    def _capture_delay(**kwargs) -> None:
        captured_email.update(kwargs)

    monkeypatch.setattr(
        "app.features.sponsors.email_delivery.send_public_sponsor_verification_email_task.delay",
        _capture_delay,
    )
    session = campaign_api_module.SessionLocal()
    campaign = seed_campaign(session, name="Public Reservation Campaign")
    campaign.public_sponsor_slug = "public-reservations"
    campaign.public_sponsor_signup_enabled = True
    gifts = _seed_gifts(session, campaign.id)
    _seed_public_registration_milestones(session, campaign.id)
    session.commit()

    client = app.test_client()
    submit_response = client.post(
        "/api/v1/public/campaigns/public-reservations/sponsors",
        json={
            "sponsor": {
                "first_name": "Jordan",
                "last_name": "Taylor",
                "email": "jordan.reserves@example.com",
                "preferred_contact": "EMAIL",
            },
            "selected_wishlist_item_ids": [str(gifts["coat_id"])],
            "website": "",
        },
    )

    assert submit_response.status_code == 202
    assert captured_email["verification_token"]
    assert (
        session.query(GiftReservation)
        .filter(GiftReservation.wishlist_item_id == gifts["coat_id"], GiftReservation.active_wishlist_item_id == gifts["coat_id"])
        .count()
        == 0
    )

    available_response = client.get("/api/v1/public/campaigns/public-reservations/gifts/search?q=coat")
    assert available_response.status_code == 200
    assert available_response.get_json()["count"] == 1

    verify_response = client.post(
        "/api/v1/public/campaigns/public-reservations/sponsors/verify",
        json={"token": captured_email["verification_token"]},
    )
    assert verify_response.status_code == 200

    commit_response = client.post(
        "/api/v1/public/campaigns/public-reservations/sponsors/verified-gifts",
        json={
            "token": captured_email["verification_token"],
            "selected_wishlist_item_ids": [str(gifts["coat_id"])],
        },
    )
    assert commit_response.status_code == 200
    session.expire_all()
    assert session.query(SponsorshipItem).filter(SponsorshipItem.wishlist_item_id == gifts["coat_id"]).count() == 1
    assert session.query(WishlistItem).filter(WishlistItem.id == gifts["coat_id"]).one().status == "COMMITTED"

    search_response = client.get("/api/v1/public/campaigns/public-reservations/gifts/search?q=coat")
    assert search_response.status_code == 200
    search_payload = search_response.get_json()
    assert search_payload["count"] == 0


def test_gift_operations_receive_wrap_ready_and_update_sponsor_dropoff(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Ops Manager")
    campaign = seed_campaign(session, name="Gift Operations Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    operations_response = client.get(
        f"/api/v1/campaigns/{campaign.id}/gifts/operations",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert operations_response.status_code == 200
    operations_payload = operations_response.get_json()
    assert operations_payload["counts"]["COMMITTED"] == 1

    receive_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['sponsored_id']}/receive",
        json={"notes": "Dropped off at front desk."},
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert receive_response.status_code == 200
    assert receive_response.get_json()["gift"]["status"] == "RECEIVED"

    wrap_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['sponsored_id']}/wrap",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert wrap_response.status_code == 200
    assert wrap_response.get_json()["gift"]["status"] == "WRAPPED"

    ready_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['sponsored_id']}/ready",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert ready_response.status_code == 200
    assert ready_response.get_json()["gift"]["status"] == "READY_FOR_DISTRIBUTION"

    pickup_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['sponsored_id']}/pickup",
        json={"notes": "Guardian picked it up."},
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert pickup_response.status_code == 200
    pickup_payload = pickup_response.get_json()
    assert pickup_payload["gift"]["status"] == "PICKED_UP"
    assert pickup_payload["gift"]["qty_fulfilled"] == 1

    session.expire_all()
    sponsorship = session.query(Sponsorship).filter(Sponsorship.campaign_id == campaign.id).one()
    assert sponsorship.drop_off_status == "RECEIVED"
    assert sponsorship.drop_off_completed_at is not None
    event_types = [
        row.event_type
        for row in session.query(ItemEvent)
        .filter(ItemEvent.wishlist_item_id == gifts["sponsored_id"])
        .order_by(ItemEvent.event_at.asc())
        .all()
    ]
    assert event_types == ["RECEIVED", "WRAPPED", "STATUS_CHANGED", "STATUS_CHANGED"]


def test_gift_operations_exception_blocks_receive_until_resolved(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Ops Manager")
    campaign = seed_campaign(session, name="Gift Exception Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    exception_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['sponsored_id']}/exception",
        json={"notes": "Gift damaged."},
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert exception_response.status_code == 200
    assert exception_response.get_json()["gift"]["status"] == "EXCEPTION"

    receive_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/{gifts['sponsored_id']}/receive",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert receive_response.status_code == 200
    assert receive_response.get_json()["gift"]["status"] == "RECEIVED"


def test_gift_pool_intake_matches_and_assignment(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Pool Manager")
    campaign = seed_campaign(session, name="Gift Pool Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    create_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/donations",
        json={
            "source": "DROP_OFF",
            "notes": "Toy drive table",
            "lines": [
                {
                    "description": "Winter coat",
                    "category": "Outerwear",
                    "size": "Youth medium",
                    "quantity": 1,
                    "age_min": 7,
                    "age_max": 10,
                    "gender_fit": "F",
                    "source_label": "Coat drive",
                }
            ],
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert create_response.status_code == 201
    line_id = create_response.get_json()["donation"]["lines"][0]["id"]

    pool_response = client.get(
        f"/api/v1/campaigns/{campaign.id}/gift-pool",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert pool_response.status_code == 200
    pool_payload = pool_response.get_json()
    assert pool_payload["counts"]["AVAILABLE"] == 1
    assert pool_payload["lines"][0]["quantity_available"] == 1

    matches_response = client.get(
        f"/api/v1/campaigns/{campaign.id}/donation-lines/{line_id}/matches",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert matches_response.status_code == 200
    matches = matches_response.get_json()["matches"]
    assert matches[0]["wishlist_item"]["wishlist_item_id"] == str(gifts["coat_id"])
    assert "category" in matches[0]["reasons"]
    assert "age" in matches[0]["reasons"]

    assign_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/donation-lines/{line_id}/assign",
        json={
            "wishlist_item_id": str(gifts["coat_id"]),
            "quantity": 1,
            "notes": "Matched from coat drive.",
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert assign_response.status_code == 201
    assign_payload = assign_response.get_json()
    assert assign_payload["line"]["inventory_status"] == "ASSIGNED"
    assert assign_payload["line"]["quantity_available"] == 0
    assert assign_payload["gift"]["status"] == "RECEIVED"

    session.expire_all()
    line = session.query(DonationLine).filter(DonationLine.id == uuid.UUID(line_id)).one()
    assert line.quantity_assigned == 1
    assert session.query(Fulfillment).filter(Fulfillment.donation_line_id == line.id).count() == 1
    assert session.query(ItemEvent).filter(ItemEvent.wishlist_item_id == gifts["coat_id"], ItemEvent.event_type == "RECEIVED").count() == 1


def test_gift_label_print_job_creates_label_rows_and_opaque_scan_path(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Label Manager")
    campaign = seed_campaign(session, name="Gift Label Campaign")
    campaign.season_theme = "Christmas Giving"
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gift-labels/print-jobs",
        json={
            "wishlist_item_ids": [str(gifts["sponsored_id"])],
            "copies": 2,
            "format": "TAG",
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 201
    payload = response.get_json()["print_job"]
    assert payload["format"] == "TAG"
    assert payload["items"][0]["copies"] == 2
    label = payload["items"][0]["label"]
    assert label["scan_path"] == "/public/gifts/scan/gift-search-sponsored"
    assert str(gifts["sponsored_id"]) not in label["scan_path"]
    assert label["recipient"]["program_recipient_id"] == "CH-001"
    assert label["recipient"]["age"] == 8
    assert label["recipient"]["gender"] == "F"
    assert label["theme"]["icon"] == "bi-tree-fill"

    session.expire_all()
    assert session.query(LabelPrintJob).filter(LabelPrintJob.campaign_id == campaign.id).count() == 1
    assert session.query(LabelPrintItem).filter(LabelPrintItem.wishlist_item_id == gifts["sponsored_id"]).count() == 1
    assert session.query(ItemEvent).filter(ItemEvent.wishlist_item_id == gifts["sponsored_id"], ItemEvent.event_type == "LABEL_PRINTED").count() == 1


def test_blank_gift_label_print_job_creates_unassigned_manual_labels(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manual Label Manager")
    campaign = seed_campaign(session, name="Manual Label Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gift-labels/print-jobs",
        json={
            "wishlist_item_ids": [],
            "manual_quantity": 3,
            "format": "TAG",
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 201
    payload = response.get_json()["print_job"]
    assert payload["format"] == "TAG"
    assert len(payload["items"]) == 3
    first_item = payload["items"][0]
    assert first_item["wishlist_item_id"] is None
    assert first_item["manual_label_id"] is not None
    assert first_item["gift"] is None
    assert first_item["label"]["label_type"] == "MANUAL"
    assert first_item["label"]["gift"]["label_code"].startswith("MAN-")

    lookup_response = client.get(first_item["label"]["scan_path"].replace("/public", "/api/v1/public"))
    assert lookup_response.status_code == 200
    lookup_payload = lookup_response.get_json()
    assert lookup_payload["gift"]["status"] == "UNASSIGNED"
    assert lookup_payload["message"] == "This tag is not attached to a gift yet."
    assert lookup_payload["available_actions"] == []

    session.expire_all()
    assert session.query(CampaignManualGiftLabel).filter(CampaignManualGiftLabel.campaign_id == campaign.id).count() == 3
    assert session.query(LabelPrintItem).filter(LabelPrintItem.manual_label_id.isnot(None)).count() == 3


def test_gift_scan_lookup_and_action_record_scan_events(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Scan Manager")
    campaign = seed_campaign(session, name="Gift Scan Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    lookup_response = client.get(
        f"/api/v1/campaigns/{campaign.id}/gifts/scan/gift-search-sponsored",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert lookup_response.status_code == 200
    lookup_payload = lookup_response.get_json()
    assert lookup_payload["gift"]["wishlist_item_id"] == str(gifts["sponsored_id"])
    assert "RECEIVE" in lookup_payload["available_actions"]

    receive_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/scan/gift-search-sponsored/actions",
        json={"action": "RECEIVE", "notes": "Scanned at receiving table."},
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert receive_response.status_code == 200
    assert receive_response.get_json()["gift"]["status"] == "RECEIVED"

    wrap_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gifts/scan/gift-search-sponsored/actions",
        json={"action": "WRAP"},
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert wrap_response.status_code == 200
    assert wrap_response.get_json()["gift"]["status"] == "WRAPPED"

    session.expire_all()
    actions = [
        row.action_taken
        for row in session.query(ScanEvent)
        .filter(ScanEvent.label_code == "gift-search-sponsored")
        .order_by(ScanEvent.scanned_at.asc())
        .all()
    ]
    assert actions == ["LOOKUP", "MARK_RECEIVED", "MARK_WRAPPED"]
    item = session.query(WishlistItem).filter(WishlistItem.id == gifts["sponsored_id"]).one()
    assert item.status == "WRAPPED"


def test_public_gift_scan_lookup_and_pickup_action(app) -> None:
    session = campaign_api_module.SessionLocal()
    campaign = seed_campaign(session, name="Public Gift Scan Campaign")
    gifts = _seed_gifts(session, campaign.id)
    item = session.query(WishlistItem).filter(WishlistItem.id == gifts["sponsored_id"]).one()
    item.status = "READY_FOR_DISTRIBUTION"
    session.commit()

    client = app.test_client()
    lookup_response = client.get("/api/v1/public/gifts/scan/gift-search-sponsored")

    assert lookup_response.status_code == 200
    lookup_payload = lookup_response.get_json()
    assert lookup_payload["campaign"]["id"] == str(campaign.id)
    assert lookup_payload["gift"]["wishlist_item_id"] == str(gifts["sponsored_id"])
    assert lookup_payload["gift"]["description"] == "Building blocks"
    assert lookup_payload["gift"]["status"] == "READY_FOR_DISTRIBUTION"
    assert lookup_payload["recipient"]["display_label"] == "Ava Johnson"
    assert lookup_payload["recipient"]["program_recipient_id"] == "CH-001"
    assert lookup_payload["scan_path"] == "/public/gifts/scan/gift-search-sponsored"
    assert "PICKUP" in lookup_payload["available_actions"]
    assert "REPRINT" not in lookup_payload["available_actions"]

    pickup_response = client.post(
        "/api/v1/public/gifts/scan/gift-search-sponsored/actions",
        json={"action": "PICKUP", "notes": "Parking lot handoff."},
    )

    assert pickup_response.status_code == 200
    assert pickup_response.get_json()["gift"]["status"] == "PICKED_UP"

    session.expire_all()
    item = session.query(WishlistItem).filter(WishlistItem.id == gifts["sponsored_id"]).one()
    assert item.status == "PICKED_UP"
    actions = [
        row.action_taken
        for row in session.query(ScanEvent)
        .filter(ScanEvent.label_code == "gift-search-sponsored")
        .order_by(ScanEvent.scanned_at.asc())
        .all()
    ]
    assert actions == ["LOOKUP", "MARK_PICKED_UP"]


def test_gift_workflow_report_groups_recipients_and_gift_statuses(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Report Manager")
    campaign = seed_campaign(session, name="Gift Report Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_gifts(session, campaign.id)
    session.commit()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign.id}/gifts/reports/workflow",
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["campaign"]["id"] == str(campaign.id)
    assert payload["counts"]["recipient_count"] == 1
    assert payload["counts"]["gift_count"] == 3
    assert payload["counts"]["open_count"] == 2
    assert payload["counts"]["committed_count"] == 1
    assert payload["counts"]["recipients_covered_count"] == 0
    assert payload["counts"]["recipients_needing_gifts_count"] == 1
    assert payload["gift_policy"]["recipient_coverage_rule"] == "ALL_GIFTS_SPONSORED"
    recipient = payload["recipients"][0]
    assert recipient["display_label"] == "Ava Johnson"
    assert recipient["group"]["name"] == "Johnson Family"
    assert recipient["coverage"] == {
        "rule": "ALL_GIFTS_SPONSORED",
        "required_count": 3,
        "sponsored_count": 1,
        "remaining_count": 2,
        "is_covered": False,
    }
    assert {gift["description"]: gift["status"] for gift in recipient["gifts"]} == {
        "Art kit": "OPEN",
        "Winter coat": "OPEN",
        "Building blocks": "COMMITTED",
    }
    sponsored_gift = next(gift for gift in recipient["gifts"] if gift["description"] == "Building blocks")
    assert sponsored_gift["sponsor"]["display_name"] == "Sponsor One"


def test_gift_workflow_report_counts_picked_up_gifts_as_fulfilled(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Report Quantity Manager")
    campaign = seed_campaign(session, name="Gift Report Quantity Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    item = session.query(WishlistItem).filter(WishlistItem.id == gifts["sponsored_id"]).one()
    item.status = "PICKED_UP"
    item.qty_fulfilled = 0
    session.commit()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign.id}/gifts/reports/workflow",
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    recipient = response.get_json()["recipients"][0]
    sponsored_gift = next(gift for gift in recipient["gifts"] if gift["description"] == "Building blocks")
    assert sponsored_gift["quantity_requested"] == 1
    assert sponsored_gift["quantity_fulfilled"] == 1


def test_gift_reminder_rules_preview_committed_unreceived_sponsors(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Reminder Manager")
    campaign = seed_campaign(session, name="Gift Reminder Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_gifts(session, campaign.id)
    _seed_gift_reminder_dependencies(session, campaign.id)
    sponsor = session.query(Sponsor).filter(Sponsor.display_name == "Sponsor One").one()
    sponsor.email = "sponsor.one@example.com"
    session.commit()

    template = session.query(CommunicationTemplate).filter(CommunicationTemplate.campaign_id == campaign.id).one()
    client = app.test_client()
    create_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gift-reminder-rules",
        json={
            "label": "Gift due reminder",
            "audience": "SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS",
            "milestone_key": "gift_intake_end",
            "offset_days": -2,
            "template_id": str(template.id),
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert create_response.status_code == 201
    rule_id = create_response.get_json()["rule"]["id"]

    list_response = client.get(
        f"/api/v1/campaigns/{campaign.id}/gift-reminder-rules",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert list_response.status_code == 200
    list_payload = list_response.get_json()
    assert list_payload["rules"][0]["label"] == "Gift due reminder"
    assert list_payload["template_options"][0]["id"] == str(template.id)
    assert list_payload["milestone_options"][0]["milestone_key"] == "gift_intake_end"

    preview_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gift-reminder-rules/{rule_id}/preview",
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert preview_response.status_code == 200
    preview = preview_response.get_json()
    assert preview["recipient_count"] == 1
    assert preview["recipients"][0]["sponsor"]["email"] == "sponsor.one@example.com"
    assert preview["recipients"][0]["gifts"][0]["description"] == "Building blocks"


def test_gift_reminder_send_records_email_interaction_and_suppresses_received_gifts(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    sent_messages = []

    def _fake_send_email_message(*, recipients, subject, html, text_body=None) -> None:
        sent_messages.append(
            {
                "recipients": recipients,
                "subject": subject,
                "html": html,
                "text_body": text_body,
            }
        )

    monkeypatch.setattr("app.features.gifts.reminder_service.send_email_message", _fake_send_email_message)

    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Reminder Sender")
    campaign = seed_campaign(session, name="Gift Reminder Send Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    gifts = _seed_gifts(session, campaign.id)
    _seed_gift_reminder_dependencies(session, campaign.id, occurs_on=datetime.utcnow().date() - timedelta(days=1))
    sponsor = session.query(Sponsor).filter(Sponsor.display_name == "Sponsor One").one()
    sponsor.email = "sponsor.one@example.com"
    template = session.query(CommunicationTemplate).filter(CommunicationTemplate.campaign_id == campaign.id).one()
    rule = CampaignGiftReminderRule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        rule_key="due_reminder",
        label="Gift due reminder",
        audience="SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS",
        milestone_key="gift_intake_end",
        offset_days=0,
        template_id=template.id,
    )
    session.add(rule)
    session.commit()

    client = app.test_client()
    send_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gift-reminder-rules/{rule.id}/send",
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert send_response.status_code == 200
    payload = send_response.get_json()
    assert payload["sent_count"] == 1
    assert sent_messages[0]["recipients"] == ["sponsor.one@example.com"]
    assert "Building blocks" in sent_messages[0]["text_body"]
    assert session.query(SponsorInteraction).filter(SponsorInteraction.sponsor_id == sponsor.id).count() == 1
    assert session.query(SponsorReminder).filter(SponsorReminder.sponsor_id == sponsor.id, SponsorReminder.status == "SENT").count() == 1

    second_send_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gift-reminder-rules/{rule.id}/send",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert second_send_response.status_code == 200
    assert second_send_response.get_json()["skipped_count"] == 1
    assert len(sent_messages) == 1

    item = session.query(WishlistItem).filter(WishlistItem.id == gifts["sponsored_id"]).one()
    item.status = "RECEIVED"
    session.commit()
    preview_response = client.post(
        f"/api/v1/campaigns/{campaign.id}/gift-reminder-rules/{rule.id}/preview",
        headers=auth_header(str(manager.id), "ADMIN"),
    )
    assert preview_response.status_code == 200
    assert preview_response.get_json()["recipient_count"] == 0


def test_gift_reminder_readiness_flags_missing_template_and_milestone(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Reminder Readiness Manager")
    campaign = seed_campaign(session, name="Gift Reminder Readiness Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    session.add(
        CampaignGiftReminderRule(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            rule_key="broken_reminder",
            label="Broken reminder",
            audience="SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS",
            milestone_key="missing_gift_due",
            template_id=None,
        )
    )
    session.commit()

    readiness = CampaignStudioService().get_readiness(session, str(campaign.id))
    codes = {item["code"] for item in readiness["items"]}

    assert "missing_gift_reminder_template" in codes
    assert "missing_gift_reminder_milestone" in codes


def _seed_gifts(session, campaign_id):
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Johnson Family",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    session.add(group)
    session.flush()
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_CHILD,
        program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        first_name="Ava",
        last_name="Johnson",
        display_label="Ava Johnson",
        program_recipient_id="CH-001",
        age=8,
        age_unit="YEARS",
        gender="F",
        status=RECIPIENT_STATUS_ACTIVE,
    )
    wishlist = Wishlist(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        recipient_id=recipient.id,
        wishlist_status=WISHLIST_STATUS_READY,
    )
    coat = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        category="Outerwear",
        item_type=WISHLIST_ITEM_TYPE_CLOTHING,
        description="Winter coat",
        size="Youth medium",
        qty_requested=1,
        priority="HIGH",
        est_cost_cents=4500,
        allow_substitute=True,
        recipient_note="Prefers blue or purple.",
        notes="Staff-only sizing note.",
        status="OPEN",
        qty_fulfilled=0,
        label_code="gift-search-coat",
        label_version=1,
    )
    art_kit = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        category="Art",
        item_type=WISHLIST_ITEM_TYPE_GIFT,
        description="Art kit",
        qty_requested=1,
        priority="MEDIUM",
        allow_substitute=True,
        status="OPEN",
        qty_fulfilled=0,
        label_code="gift-search-art",
        label_version=1,
    )
    sponsored = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        category="Toy",
        item_type=WISHLIST_ITEM_TYPE_GIFT,
        description="Building blocks",
        qty_requested=1,
        priority="MEDIUM",
        allow_substitute=True,
        status="COMMITTED",
        qty_fulfilled=0,
        label_code="gift-search-sponsored",
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
        wishlist_item_id=sponsored.id,
        qty_committed=1,
    )
    session.add_all([recipient, wishlist, coat, art_kit, sponsored, sponsor, sponsorship, sponsorship_item])
    session.flush()
    return {
        "coat_id": coat.id,
        "art_kit_id": art_kit.id,
        "sponsored_id": sponsored.id,
    }


def _seed_public_registration_milestones(session, campaign_id):
    from datetime import datetime, timedelta

    from app.models.campaign_milestone import CampaignMilestone

    session.add_all(
        [
            CampaignMilestone(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                milestone_key="sponsor_registration_start",
                label="Sponsor Registration Starts",
                occurs_on=datetime.utcnow().date() - timedelta(days=1),
                sort_order=1,
            ),
            CampaignMilestone(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                milestone_key="sponsor_registration_end",
                label="Sponsor Registration Ends",
                occurs_on=datetime.utcnow().date() + timedelta(days=7),
                sort_order=2,
            ),
            CampaignMilestone(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                milestone_key="gift_intake_end",
                label="Gift Intake Ends",
                occurs_on=datetime.utcnow().date() + timedelta(days=14),
                sort_order=3,
            ),
        ]
    )


def _seed_gift_reminder_dependencies(session, campaign_id, *, occurs_on=None):
    session.add(
        CampaignMilestone(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            milestone_key="gift_intake_end",
            label="Gift Intake Ends",
            occurs_on=occurs_on or datetime.utcnow().date() + timedelta(days=7),
            sort_order=3,
        )
    )
    session.add(
        CommunicationTemplate(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            template_key="gift_due_reminder",
            name="Gift Due Reminder",
            audience="SPONSOR",
            channel="EMAIL",
            subject_template="Gift reminder for {{campaign.name}}",
            body_template="Hi {{sponsor.name}}, please bring {{gift.descriptions}}.",
            is_active=True,
        )
    )
    session.flush()
