from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.exceptions.service_error import ServiceError
from app.features.campaigns import api as campaign_api_module
from app.features.sponsors.service import CampaignSponsorService
from app.models.campaign_milestone import CampaignMilestone
from app.models.pending_sponsor_registration import PendingSponsorRegistration
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
    WISHLIST_ITEM_TYPE_GIFT,
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


def _seed_public_signup_ready_campaign(session):
    campaign = seed_campaign(session, name="Sponsor Signup Campaign")
    campaign.public_sponsor_slug = "sponsor-signup-campaign"
    campaign.public_sponsor_signup_enabled = True
    session.add_all(
        [
            CampaignMilestone(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                milestone_key="sponsor_registration_start",
                label="Sponsor Registration Starts",
                occurs_on=datetime.utcnow().date() - timedelta(days=1),
                sort_order=1,
            ),
            CampaignMilestone(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                milestone_key="sponsor_registration_end",
                label="Sponsor Registration Ends",
                occurs_on=datetime.utcnow().date() + timedelta(days=7),
                sort_order=2,
            ),
            CampaignMilestone(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                milestone_key="gift_intake_end",
                label="Gift Intake Ends",
                occurs_on=datetime.utcnow().date() + timedelta(days=14),
                sort_order=3,
            ),
        ]
    )
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Johnson Family",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    session.add(group)
    session.flush()
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_CHILD,
        program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        first_name="Ava",
        last_name="Johnson",
        display_label="Ava Johnson",
        age=8,
        age_unit="YEARS",
        status=RECIPIENT_STATUS_ACTIVE,
    )
    session.add(recipient)
    session.flush()
    wishlist = Wishlist(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_id=recipient.id,
        wishlist_status=WISHLIST_STATUS_READY,
    )
    session.add(wishlist)
    session.flush()
    session.add_all(
        [
            WishlistItem(
                id=uuid.uuid4(),
                wishlist_id=wishlist.id,
                item_type=WISHLIST_ITEM_TYPE_GIFT,
                description="Art kit",
                qty_requested=1,
                priority="MEDIUM",
                allow_substitute=True,
                status="OPEN",
                qty_fulfilled=0,
                label_code="sponsor-public-1",
                label_version=1,
            ),
            WishlistItem(
                id=uuid.uuid4(),
                wishlist_id=wishlist.id,
                item_type=WISHLIST_ITEM_TYPE_GIFT,
                description="Winter coat",
                qty_requested=1,
                priority="HIGH",
                allow_substitute=False,
                status="OPEN",
                qty_fulfilled=0,
                label_code="sponsor-public-2",
                label_version=1,
            ),
        ]
    )
    session.flush()
    return campaign


def test_sponsor_workspace_and_crud_flow(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")

    sponsor = Sponsor(
        id=uuid.uuid4(),
        first_name="Taylor",
        last_name="Reed",
        display_name="Taylor Reed",
        organization_name="Hope Church",
        email="taylor@example.com",
        phone="(555) 222-1111",
        preferred_contact="EMAIL",
        source="STAFF_ENTRY",
        is_active=True,
    )
    session.add(sponsor)
    session.flush()
    sponsorship = Sponsorship(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        sponsor_id=sponsor.id,
        status="ACTIVE",
        interest_status="CONTACTED",
        drop_off_status="NOT_STARTED",
        self_registered=False,
        sponsor_code="SP-001",
    )
    session.add(sponsorship)
    session.add(
        PendingSponsorRegistration(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            email="pending@example.com",
            preferred_contact="EMAIL",
            source="PUBLIC_LINK",
            selected_wishlist_item_ids_json=["11111111-1111-1111-1111-111111111111"],
            verification_token="pending-token-1",
            expires_at=datetime.utcnow() + timedelta(hours=24),
            status="PENDING",
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()

    workspace_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/sponsor-workspace",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert workspace_response.status_code == 200
    payload = workspace_response.get_json()
    assert payload["counts"]["sponsor_count"] == 1
    assert payload["counts"]["active_sponsorship_count"] == 1
    assert payload["counts"]["pending_registration_count"] == 1
    assert payload["sponsors"][0]["display_name"] == "Taylor Reed"
    assert payload["sponsors"][0]["participation"]["sponsor_code"] == "SP-001"

    create_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/sponsors",
        json={
            "sponsor": {
                "first_name": "Jordan",
                "last_name": "Miles",
                "email": "jordan@example.com",
                "phone": "5554443333",
                "preferred_contact": "TEXT",
                "address_line1": "123 Main St",
                "city": "Nashville",
                "state": "tn",
                "postal_code": "37203",
            },
            "participation": {
                "status": "ACTIVE",
                "interest_status": "NEW",
                "drop_off_status": "NOT_STARTED",
                "sponsor_code": "SP-002",
                "participation_notes": "Interested from church announcement.",
            },
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert create_response.status_code == 201
    created = create_response.get_json()
    assert created["email"] == "jordan@example.com"
    assert created["state"] == "TN"
    assert created["postal_code"] == "37203"
    assert created["participation"]["sponsor_code"] == "SP-002"
    sponsor_id = created["id"]

    update_response = client.patch(
        f"/api/v1/campaigns/{campaign_id}/sponsors/{sponsor_id}",
        json={
            "sponsor": {
                "phone": "1-615-444-9999",
                "do_not_contact": True,
            },
            "participation": {
                "interest_status": "COMMITTED",
                "drop_off_status": "SCHEDULED",
            },
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert update_response.status_code == 200
    updated = update_response.get_json()
    assert updated["phone"] == "1 (615) 444-9999"
    assert updated["do_not_contact"] is True
    assert updated["participation"]["interest_status"] == "COMMITTED"
    assert updated["participation"]["drop_off_status"] == "SCHEDULED"

    list_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/sponsors?search=jordan",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert list_response.status_code == 200
    assert len(list_response.get_json()) == 1
    assert list_response.get_json()[0]["display_name"] == "Jordan Miles"


def test_sponsor_interaction_crud_and_delete(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    sponsor = Sponsor(
        id=uuid.uuid4(),
        display_name="Taylor Reed",
        email="taylor@example.com",
        preferred_contact="EMAIL",
        source="STAFF_ENTRY",
        is_active=True,
    )
    session.add(sponsor)
    session.flush()
    sponsorship = Sponsorship(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        sponsor_id=sponsor.id,
        status="ACTIVE",
        interest_status="CONTACTED",
        drop_off_status="NOT_STARTED",
        self_registered=False,
    )
    session.add(sponsorship)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    sponsor_id = str(sponsor.id)
    session.commit()
    session.close()

    client = app.test_client()

    create_interaction = client.post(
        f"/api/v1/campaigns/{campaign_id}/sponsors/{sponsor_id}/interactions",
        json={
            "channel": "CALL",
            "direction": "OUTBOUND",
            "subject": "Follow-up call",
            "outcome": "LEFT_VM",
            "notes": "Asked sponsor to call back.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert create_interaction.status_code == 201
    interaction = create_interaction.get_json()
    assert interaction["origin_type"] == "MANUAL"
    interaction_id = interaction["id"]

    list_interactions = client.get(
        f"/api/v1/campaigns/{campaign_id}/sponsors/{sponsor_id}/interactions",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert list_interactions.status_code == 200
    assert len(list_interactions.get_json()) == 1

    update_interaction = client.patch(
        f"/api/v1/campaigns/{campaign_id}/sponsors/{sponsor_id}/interactions/{interaction_id}",
        json={
            "channel": "EMAIL",
            "subject": "Follow-up email",
            "outcome": "REACHED",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert update_interaction.status_code == 200
    assert update_interaction.get_json()["channel"] == "EMAIL"
    assert update_interaction.get_json()["outcome"] == "REACHED"

    delete_interaction = client.delete(
        f"/api/v1/campaigns/{campaign_id}/sponsors/{sponsor_id}/interactions/{interaction_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert delete_interaction.status_code == 204

    delete_sponsor = client.delete(
        f"/api/v1/campaigns/{campaign_id}/sponsors/{sponsor_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert delete_sponsor.status_code == 204


def test_delete_sponsor_reopens_sponsored_wishlist_items(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = _seed_public_signup_ready_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    item = session.query(WishlistItem).order_by(WishlistItem.label_code.asc()).first()
    item.status = "COMMITTED"
    sponsor = Sponsor(
        id=uuid.uuid4(),
        display_name="Taylor Reed",
        email="taylor@example.com",
        preferred_contact="EMAIL",
        source="STAFF_ENTRY",
        is_active=True,
    )
    session.add(sponsor)
    session.flush()
    sponsorship = Sponsorship(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        sponsor_id=sponsor.id,
        status="ACTIVE",
        interest_status="COMMITTED",
        drop_off_status="NOT_STARTED",
        self_registered=False,
    )
    session.add(sponsorship)
    session.flush()
    session.add(
        SponsorshipItem(
            id=uuid.uuid4(),
            sponsorship_id=sponsorship.id,
            wishlist_item_id=item.id,
            qty_committed=1,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    sponsor_id = str(sponsor.id)
    item_id = item.id
    session.commit()
    session.close()

    client = app.test_client()
    response = client.delete(
        f"/api/v1/campaigns/{campaign_id}/sponsors/{sponsor_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 204
    session = campaign_api_module.SessionLocal()
    reopened_item = session.query(WishlistItem).filter(WishlistItem.id == item_id).one()
    assert reopened_item.status == "OPEN"
    assert session.query(SponsorshipItem).filter(SponsorshipItem.wishlist_item_id == item_id).count() == 0
    session.close()


def test_public_sponsor_signup_and_verification_flow(app, monkeypatch: pytest.MonkeyPatch) -> None:
    captured_email: dict[str, object] = {}

    def _capture_delay(email, display_name, campaign_name, public_slug, verification_token):
        captured_email.update(
            {
                "email": email,
                "display_name": display_name,
                "campaign_name": campaign_name,
                "public_slug": public_slug,
                "verification_token": verification_token,
            }
        )

    monkeypatch.setattr(
        "app.features.sponsors.email_delivery.send_public_sponsor_verification_email_task.delay",
        _capture_delay,
    )

    session = campaign_api_module.SessionLocal()
    campaign = _seed_public_signup_ready_campaign(session)
    campaign_id = str(campaign.id)
    session.commit()
    item_ids = [str(item.id) for item in session.query(WishlistItem).order_by(WishlistItem.label_code.asc()).all()]
    session.close()

    client = app.test_client()

    config_response = client.get("/api/v1/public/campaigns/sponsor-signup-campaign/sponsor-config")
    assert config_response.status_code == 200
    config_payload = config_response.get_json()
    assert config_payload["registration"]["status"] == "OPEN"
    assert len(config_payload["available_items"]) == 2

    signup_response = client.post(
        "/api/v1/public/campaigns/sponsor-signup-campaign/sponsors",
        json={
            "sponsor": {
                "first_name": "Jordan",
                "last_name": "Miles",
                "email": "jordan@example.com",
                "phone": "6154442222",
                "preferred_contact": "EMAIL",
                "address_line1": "123 Main St",
                "city": "Nashville",
                "state": "tn",
                "postal_code": "37203",
            },
        },
    )
    assert signup_response.status_code == 202
    signup_payload = signup_response.get_json()
    assert signup_payload["status"] == "pending_verification"
    assert signup_payload["email_delivery_status"] == "sent"
    assert captured_email["email"] == "jordan@example.com"
    assert captured_email["public_slug"] == "sponsor-signup-campaign"

    premature_commit_response = client.post(
        "/api/v1/public/campaigns/sponsor-signup-campaign/sponsors/verified-gifts",
        json={
            "token": captured_email["verification_token"],
            "selected_wishlist_item_ids": item_ids,
        },
    )
    assert premature_commit_response.status_code == 409
    assert "verified" in premature_commit_response.get_json()["error"].lower()

    verification_response = client.post(
        "/api/v1/public/campaigns/sponsor-signup-campaign/sponsors/verify",
        json={"token": captured_email["verification_token"]},
    )
    assert verification_response.status_code == 200
    verification_payload = verification_response.get_json()
    assert verification_payload["registration"]["status"] == "VERIFIED"
    assert verification_payload["sponsor"]["email"] == "jordan@example.com"
    assert verification_payload["sponsor"]["participation"]["self_registered"] is True
    assert verification_payload["sponsor"]["sponsored_item_count"] == 0
    assert verification_payload["selection_limit"] == 3

    commit_response = client.post(
        "/api/v1/public/campaigns/sponsor-signup-campaign/sponsors/verified-gifts",
        json={
            "token": captured_email["verification_token"],
            "selected_wishlist_item_ids": item_ids,
        },
    )
    assert commit_response.status_code == 200
    commit_payload = commit_response.get_json()
    assert commit_payload["registration"]["status"] == "VERIFIED"
    assert commit_payload["sponsor"]["email"] == "jordan@example.com"
    assert commit_payload["sponsor"]["sponsored_item_count"] == 2
    assert commit_payload["gift_deadline"] is not None

    session = campaign_api_module.SessionLocal()
    sponsorships = session.query(Sponsorship).filter(Sponsorship.campaign_id == uuid.UUID(campaign_id)).all()
    assert len(sponsorships) == 1
    sponsored_items = (
        session.query(SponsorshipItem)
        .join(Sponsorship, SponsorshipItem.sponsorship_id == Sponsorship.id)
        .filter(Sponsorship.campaign_id == uuid.UUID(campaign_id))
        .all()
    )
    assert len(sponsored_items) == 2
    wishlist_statuses = {
        item.status for item in session.query(WishlistItem).all()
    }
    assert wishlist_statuses == {"COMMITTED"}
    session.close()


def test_public_sponsor_verification_returns_conflict_on_reservation_integrity_error(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = campaign_api_module.SessionLocal()
    campaign = _seed_public_signup_ready_campaign(session)
    item = session.query(WishlistItem).order_by(WishlistItem.label_code.asc()).first()
    sponsor = Sponsor(
        id=uuid.uuid4(),
        display_name="Jordan Miles",
        email="jordan@example.com",
        preferred_contact="EMAIL",
        source="PUBLIC_LINK",
        is_active=True,
    )
    session.add(sponsor)
    session.flush()
    sponsorship = Sponsorship(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        sponsor_id=sponsor.id,
        status="ACTIVE",
        interest_status="NEW",
        drop_off_status="NOT_STARTED",
        self_registered=False,
    )
    session.add(sponsorship)
    registration = PendingSponsorRegistration(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        matched_sponsor_id=sponsor.id,
        email="jordan@example.com",
        first_name="Jordan",
        last_name="Miles",
        display_name="Jordan Miles",
        preferred_contact="EMAIL",
        source="PUBLIC_LINK",
        selected_wishlist_item_ids_json=[str(item.id)],
        verification_token="conflict-token",
        expires_at=datetime.utcnow() + timedelta(hours=24),
        status="PENDING",
    )
    session.add(registration)
    CampaignSponsorService().gift_policy.get_policy(session, campaign.id)
    session.commit()

    def _raise_integrity_error(*args, **kwargs):
        raise IntegrityError("insert sponsorship_item", {}, Exception("duplicate wishlist item"))

    monkeypatch.setattr(session, "flush", _raise_integrity_error)

    with pytest.raises(ServiceError) as error:
        CampaignSponsorService().verify_public_registration(
            session,
            "sponsor-signup-campaign",
            "conflict-token",
        )

    assert error.value.status_code == 409
    assert error.value.details["unavailable_wishlist_item_ids"] == [str(item.id)]
    session.close()


def test_staff_can_recover_pending_public_sponsor_registrations(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_email: dict[str, object] = {}

    def _capture_delay(email, display_name, campaign_name, public_slug, verification_token):
        captured_email.update(
            {
                "email": email,
                "display_name": display_name,
                "campaign_name": campaign_name,
                "public_slug": public_slug,
                "verification_token": verification_token,
            }
        )

    monkeypatch.setattr(
        "app.features.sponsors.email_delivery.send_public_sponsor_verification_email_task.delay",
        _capture_delay,
    )
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = _seed_public_signup_ready_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    item_ids = [str(item.id) for item in session.query(WishlistItem).order_by(WishlistItem.label_code.asc()).all()]
    cancel_registration = PendingSponsorRegistration(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        email="cancel-me@example.com",
        first_name="Cancel",
        last_name="Me",
        display_name="Cancel Me",
        preferred_contact="EMAIL",
        source="PUBLIC_LINK",
        selected_wishlist_item_ids_json=[item_ids[0]],
        verification_token="cancel-token",
        expires_at=datetime.utcnow() + timedelta(hours=24),
        status="PENDING",
    )
    verify_registration = PendingSponsorRegistration(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        email="verify-me@example.com",
        first_name="Verify",
        last_name="Me",
        display_name="Verify Me",
        preferred_contact="EMAIL",
        source="PUBLIC_LINK",
        selected_wishlist_item_ids_json=[item_ids[1]],
        verification_token="verify-token",
        expires_at=datetime.utcnow() + timedelta(hours=24),
        status="PENDING",
    )
    session.add_all([cancel_registration, verify_registration])
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    cancel_registration_id = str(cancel_registration.id)
    verify_registration_id = str(verify_registration.id)
    session.commit()
    session.close()

    client = app.test_client()
    resend_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/pending-sponsor-registrations/{cancel_registration_id}/resend",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert resend_response.status_code == 200
    resend_payload = resend_response.get_json()
    assert resend_payload["email_delivery_status"] == "sent"
    assert resend_payload["registration"]["status"] == "PENDING"
    assert captured_email["email"] == "cancel-me@example.com"
    assert captured_email["verification_token"] != "cancel-token"

    cancel_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/pending-sponsor-registrations/{cancel_registration_id}/cancel",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert cancel_response.status_code == 200
    assert cancel_response.get_json()["registration"]["status"] == "CANCELLED"

    verify_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/pending-sponsor-registrations/{verify_registration_id}/verify",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert verify_response.status_code == 200
    verify_payload = verify_response.get_json()
    assert verify_payload["registration"]["status"] == "VERIFIED"
    assert verify_payload["sponsor"]["email"] == "verify-me@example.com"
    assert verify_payload["sponsor"]["sponsored_item_count"] == 1


def test_public_sponsor_client_ip_only_trusts_forwarded_header_from_trusted_proxy(
    app,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.features.public import sponsor_public_api

    monkeypatch.setattr(sponsor_public_api, "BT_TRUSTED_PROXY_IPS", ())
    with app.test_request_context(
        "/api/v1/public/campaigns/demo/sponsors",
        headers={"X-Forwarded-For": "203.0.113.10"},
        environ_base={"REMOTE_ADDR": "10.0.0.10"},
    ):
        assert sponsor_public_api._client_ip() == "10.0.0.10"

    monkeypatch.setattr(sponsor_public_api, "BT_TRUSTED_PROXY_IPS", ("10.0.0.10",))
    with app.test_request_context(
        "/api/v1/public/campaigns/demo/sponsors",
        headers={"X-Forwarded-For": "203.0.113.10, 10.0.0.10"},
        environ_base={"REMOTE_ADDR": "10.0.0.10"},
    ):
        assert sponsor_public_api._client_ip() == "203.0.113.10"


def test_public_sponsor_signup_survives_email_delivery_failure(app, monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise_delivery_error(*args, **kwargs):
        raise RuntimeError("mail transport down")

    monkeypatch.setattr(
        "app.features.sponsors.email_delivery.send_public_sponsor_verification_email_task.delay",
        _raise_delivery_error,
    )
    monkeypatch.setattr(
        "app.email.mailer.send_public_sponsor_verification_email",
        _raise_delivery_error,
    )

    session = campaign_api_module.SessionLocal()
    _seed_public_signup_ready_campaign(session)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        "/api/v1/public/campaigns/sponsor-signup-campaign/sponsors",
        json={
            "sponsor": {
                "first_name": "Jordan",
                "last_name": "Miles",
                "email": "jordan@example.com",
            },
        },
    )

    assert response.status_code == 202
    payload = response.get_json()
    assert payload["email_delivery_status"] == "failed"
    assert "could not be sent" in payload["message"]

    session = campaign_api_module.SessionLocal()
    registration = (
        session.query(PendingSponsorRegistration)
        .filter(PendingSponsorRegistration.email == "jordan@example.com")
        .one()
    )
    assert registration.status == "PENDING"
    assert registration.selected_wishlist_item_ids_json == []
    session.close()


def test_public_sponsor_signup_requires_open_registration_window(app, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.features.sponsors.email_delivery.send_public_sponsor_verification_email_task.delay",
        lambda *args, **kwargs: None,
    )
    session = campaign_api_module.SessionLocal()
    campaign = _seed_public_signup_ready_campaign(session)
    campaign.public_sponsor_slug = "closed-sponsor-campaign"
    for milestone in session.query(CampaignMilestone).filter(CampaignMilestone.campaign_id == campaign.id):
        if milestone.milestone_key == "sponsor_registration_end":
            milestone.occurs_on = datetime.utcnow().date() - timedelta(days=1)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        "/api/v1/public/campaigns/closed-sponsor-campaign/sponsors",
        json={
            "sponsor": {
                "first_name": "Closed",
                "last_name": "Window",
                "email": "closed@example.com",
            },
        },
    )
    assert response.status_code == 409
    assert response.get_json()["details"]["registration_status"] == "CLOSED"
