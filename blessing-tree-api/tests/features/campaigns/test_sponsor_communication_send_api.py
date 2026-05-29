from __future__ import annotations

import uuid
from datetime import date

from app.features.campaigns import sponsor_api as sponsor_api_module
from app.features.campaigns.studio_service import CampaignStudioService
from app.models.campaign_communication_send import CampaignCommunicationSend
from app.models.campaign_communication_send_recipient import CampaignCommunicationSendRecipient
from app.models.campaign_member import CampaignMember
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember
from app.models.communication_audience_constants import COMMUNICATION_AUDIENCE_GENERAL, COMMUNICATION_AUDIENCE_SPONSOR
from app.models.communication_template import CommunicationTemplate
from app.models.group_contact import GroupContact
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
    WISHLIST_ITEM_TYPE_GIFT,
    WISHLIST_STATUS_READY,
)
from app.models.recipient_group import RecipientGroup
from app.models.sponsor import Sponsor
from app.models.sponsor_interaction import SponsorInteraction
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


def test_preview_sponsor_communication_renders_gift_merge_fields(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Blessing Tree 2026")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    sponsor, template = _seed_sponsor_template_context(session, campaign.id)
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/sponsors/{sponsor.id}/communications/preview",
        json={"template_id": str(template.id)},
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["recipient_email"] == "sponsor@example.com"
    assert payload["subject"] == "Reminder: gifts for Blessing Tree 2026"
    assert payload["merge_fields"]["gift.commitment_count"] == "2"
    assert "Ava Public: Winter coat" in payload["text"]
    assert "Noah Display: Board game" in payload["text"]
    assert payload["merge_fields"]["gift.due_date"] == "2026-12-10"
    assert payload["warnings"] == []


def test_preview_warns_when_template_has_no_matching_gifts(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Warning Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    sponsor = _seed_sponsor(session, campaign.id, email="empty-sponsor@example.com")
    template = _seed_template(
        session,
        campaign.id,
        body_template="Hi {{sponsor.first_name}}\n{{gift.awaiting_turn_in_list}}",
    )
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/sponsors/{sponsor.id}/communications/preview",
        json={"template_id": str(template.id)},
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    warnings = response.get_json()["warnings"]
    assert warnings == [
        {
            "code": "no_awaiting_turn_in_gifts",
            "message": "This sponsor has no gifts awaiting turn-in.",
        }
    ]


def test_send_sponsor_communication_records_send_recipient_and_interaction(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    delivered: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.features.campaigns.communication_send_service.send_email_message",
        lambda **kwargs: delivered.append(kwargs),
    )
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Send Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    sponsor, template = _seed_sponsor_template_context(session, campaign.id)
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/sponsors/{sponsor.id}/communications/send",
        json={"template_id": str(template.id)},
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "SENT"
    assert delivered[0]["recipients"] == ["sponsor@example.com"]
    assert "Winter coat" in delivered[0]["text_body"]

    send = session.query(CampaignCommunicationSend).one()
    assert str(send.id) == payload["send_id"]
    assert send.status == "SENT"
    assert send.recipient_count == 1
    assert send.delivered_count == 1

    recipient = session.query(CampaignCommunicationSendRecipient).one()
    assert recipient.send_id == send.id
    assert recipient.recipient_type == "SPONSOR"
    assert recipient.email == "sponsor@example.com"
    assert recipient.status == "SENT"

    interaction = session.query(SponsorInteraction).one()
    assert interaction.sponsor_id == sponsor.id
    assert interaction.origin_type == "CAMPAIGN_COMMUNICATION"
    assert interaction.outcome == "COMPLETED"
    assert interaction.related_delivery_attempt_id == str(send.id)


def test_send_rejects_non_sponsor_template(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Wrong Audience Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    sponsor = _seed_sponsor(session, campaign.id)
    template = _seed_template(session, campaign.id, audience=COMMUNICATION_AUDIENCE_GENERAL)
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/sponsors/{sponsor.id}/communications/send",
        json={"template_id": str(template.id)},
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 409
    assert "Only sponsor audience templates" in response.get_json()["error"]


def test_send_campaign_communication_to_template_audience_records_history(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    delivered: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.features.campaigns.communication_send_service.send_email_message",
        lambda **kwargs: delivered.append(kwargs),
    )
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = seed_campaign(session, name="Audience Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    sponsor = _seed_sponsor(session, campaign.id, email="audience-sponsor@example.com")
    template = _seed_template(
        session,
        campaign.id,
        body_template="Hi {{sponsor.first_name}}, this is a campaign note.",
    )
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/communications/send",
        json={"template_id": str(template.id), "target_mode": "AUDIENCE"},
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "SENT"
    assert payload["recipient_count"] == 1
    assert delivered[0]["recipients"] == ["audience-sponsor@example.com"]
    assert "Hi Jane" in delivered[0]["text_body"]

    send = session.query(CampaignCommunicationSend).one()
    assert send.target_mode == "AUDIENCE"
    assert send.delivered_count == 1

    recipient = session.query(CampaignCommunicationSendRecipient).one()
    assert recipient.recipient_type == "SPONSOR"
    assert recipient.email == "audience-sponsor@example.com"

    interaction = session.query(SponsorInteraction).one()
    assert interaction.sponsor_id == sponsor.id
    assert interaction.related_delivery_attempt_id == str(send.id)


def test_send_campaign_communication_to_manual_emails_records_manual_recipients(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    delivered: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.features.campaigns.communication_send_service.send_email_message",
        lambda **kwargs: delivered.append(kwargs),
    )
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = seed_campaign(session, name="Manual Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    template = _seed_template(
        session,
        campaign.id,
        audience=COMMUNICATION_AUDIENCE_GENERAL,
        body_template="Hi {{contact.first_name}}, this is a direct update.",
    )
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/communications/send",
        json={
            "template_id": str(template.id),
            "target_mode": "MANUAL_EMAIL",
            "manual_recipients": [
                {"display_name": "Pat Coordinator", "email": "pat@example.test"},
                {"email": "helper@example.test"},
            ],
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "SENT"
    assert payload["recipient_count"] == 2
    assert [item["recipients"][0] for item in delivered] == ["pat@example.test", "helper@example.test"]
    assert "Hi Pat" in delivered[0]["text_body"]

    recipients = session.query(CampaignCommunicationSendRecipient).order_by(CampaignCommunicationSendRecipient.email.asc()).all()
    assert [recipient.recipient_type for recipient in recipients] == ["MANUAL", "MANUAL"]
    assert session.query(SponsorInteraction).count() == 0


def test_send_campaign_communication_to_selected_sponsors_records_sponsor_recipients(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    delivered: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.features.campaigns.communication_send_service.send_email_message",
        lambda **kwargs: delivered.append(kwargs),
    )
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = seed_campaign(session, name="Selected Sponsor Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    sponsor = _seed_sponsor(session, campaign.id, email="selected-sponsor@example.com")
    _seed_sponsor(session, campaign.id, email="other-sponsor@example.com")
    template = _seed_template(
        session,
        campaign.id,
        body_template="Hi {{sponsor.first_name}}, this is for selected sponsors.",
    )
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/communications/send",
        json={
            "template_id": str(template.id),
            "target_mode": "SELECTED_SPONSORS",
            "sponsor_ids": [str(sponsor.id)],
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    assert response.get_json()["recipient_count"] == 1
    assert delivered[0]["recipients"] == ["selected-sponsor@example.com"]

    send = session.query(CampaignCommunicationSend).one()
    assert send.target_mode == "SELECTED_SPONSORS"
    recipient = session.query(CampaignCommunicationSendRecipient).one()
    assert recipient.recipient_type == "SPONSOR"
    assert recipient.recipient_ref_id == sponsor.id


def test_send_campaign_communication_to_team_records_member_recipients(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    delivered: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.features.campaigns.communication_send_service.send_email_message",
        lambda **kwargs: delivered.append(kwargs),
    )
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = seed_campaign(session, name="Team Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name="Pat Volunteer",
        email="pat-volunteer@example.test",
        member_type="volunteer",
        is_active=True,
    )
    team = CampaignTeam(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        name="Pickup Team",
        is_active=True,
    )
    session.add_all([member, team])
    session.flush()
    session.add(
        CampaignTeamMember(
            id=uuid.uuid4(),
            team_id=team.id,
            campaign_member_id=member.id,
        )
    )
    template = _seed_template(
        session,
        campaign.id,
        audience=COMMUNICATION_AUDIENCE_GENERAL,
        body_template="Hi {{volunteer.first_name}}, team note.",
    )
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/communications/send",
        json={
            "template_id": str(template.id),
            "target_mode": "TEAM",
            "team_ids": [str(team.id)],
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    assert response.get_json()["recipient_count"] == 1
    assert delivered[0]["recipients"] == ["pat-volunteer@example.test"]
    assert "Hi Pat" in delivered[0]["text_body"]

    send = session.query(CampaignCommunicationSend).one()
    assert send.target_mode == "TEAM"
    recipient = session.query(CampaignCommunicationSendRecipient).one()
    assert recipient.recipient_type == "MEMBER"
    assert recipient.recipient_ref_id == member.id


def test_send_campaign_communication_to_selected_contacts_records_contact_recipients(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    delivered: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.features.campaigns.communication_send_service.send_email_message",
        lambda **kwargs: delivered.append(kwargs),
    )
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Campaign Manager")
    campaign = seed_campaign(session, name="Contact Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Garcia Family",
        status="ACTIVE",
    )
    session.add(group)
    session.flush()
    contact = GroupContact(
        id=uuid.uuid4(),
        recipient_group_id=group.id,
        first_name="Riley",
        last_name="Garcia",
        email="riley@example.test",
        preferred_contact="EMAIL",
        is_primary=True,
    )
    session.add(contact)
    template = _seed_template(
        session,
        campaign.id,
        audience=COMMUNICATION_AUDIENCE_GENERAL,
        body_template="Hi {{contact.first_name}}, family note.",
    )
    session.commit()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign.id}/communications/send",
        json={
            "template_id": str(template.id),
            "target_mode": "SELECTED_CONTACTS",
            "contact_ids": [str(contact.id)],
        },
        headers=auth_header(str(manager.id), "ADMIN"),
    )

    assert response.status_code == 200
    assert response.get_json()["recipient_count"] == 1
    assert delivered[0]["recipients"] == ["riley@example.test"]
    assert "Hi Riley" in delivered[0]["text_body"]

    send = session.query(CampaignCommunicationSend).one()
    assert send.target_mode == "SELECTED_CONTACTS"
    recipient = session.query(CampaignCommunicationSendRecipient).one()
    assert recipient.recipient_type == "CONTACT"
    assert recipient.recipient_ref_id == contact.id


def test_readiness_blocks_sponsor_due_date_template_without_gift_turn_in_due(app, monkeypatch) -> None:
    install_auth(monkeypatch)
    session = sponsor_api_module.SessionLocal()
    manager = seed_user(session, name="Gift Manager")
    campaign = seed_campaign(session, name="Readiness Campaign")
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    _seed_template(
        session,
        campaign.id,
        body_template="Please turn in gifts by {{gift.due_date}}.",
    )
    session.commit()

    readiness = CampaignStudioService().get_readiness(session, str(campaign.id))
    items_by_code = {item["code"]: item for item in readiness["items"]}

    assert "missing_gift_turn_in_due_milestone" in items_by_code
    item = items_by_code["missing_gift_turn_in_due_milestone"]
    assert item["severity"] == "error"
    assert item["category"] == "blockers"
    assert item["blocking_for"] == ["activate", "operations"]


def _seed_sponsor_template_context(session, campaign_id):
    sponsor = _seed_sponsor(session, campaign_id)
    template = _seed_template(session, campaign_id)
    session.add(
        CampaignMilestone(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            milestone_key="gift_turn_in_due",
            label="Gift Turn-In Due",
            occurs_on=date(2026, 12, 10),
            sort_order=8,
        )
    )
    _seed_gift(session, campaign_id, sponsor, "Ava Public", "Ava Display", "Winter coat", "COMMITTED")
    _seed_gift(session, campaign_id, sponsor, None, "Noah Display", "Board game", "RECEIVED")
    return sponsor, template


def _seed_template(
    session,
    campaign_id,
    *,
    audience: str = COMMUNICATION_AUDIENCE_SPONSOR,
    body_template: str | None = None,
):
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        template_key=f"template-{uuid.uuid4()}",
        name="Sponsor Gift Reminder",
        audience=audience,
        channel="EMAIL",
        subject_template="Reminder: gifts for {{campaign.name}}",
        body_template=body_template
        or (
            "Hi {{sponsor.first_name}},\n"
            "Please turn in gifts by {{gift.due_date}}.\n"
            "{{gift.awaiting_turn_in_list}}\n"
            "{{gift.received_or_later_list}}"
        ),
        is_active=True,
    )
    session.add(template)
    session.flush()
    return template


def _seed_sponsor(session, campaign_id, *, email: str = "sponsor@example.com"):
    sponsor = Sponsor(
        id=uuid.uuid4(),
        first_name="Jane",
        last_name="Sponsor",
        display_name="Jane Sponsor",
        email=email,
        preferred_contact="EMAIL",
        source="STAFF_ENTRY",
        is_active=True,
    )
    session.add(sponsor)
    session.flush()
    sponsorship = Sponsorship(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        sponsor_id=sponsor.id,
        status="ACTIVE",
        interest_status="COMMITTED",
        drop_off_status="NOT_STARTED",
    )
    session.add(sponsorship)
    session.flush()
    return sponsor


def _seed_gift(session, campaign_id, sponsor, public_label, display_label, description, status):
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name=f"{display_label} Family",
        status="ACTIVE",
    )
    session.add(group)
    session.flush()
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_CHILD,
        program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
        display_label=display_label,
        public_label=public_label,
        status=RECIPIENT_STATUS_ACTIVE,
    )
    session.add(recipient)
    session.flush()
    wishlist = Wishlist(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        recipient_id=recipient.id,
        wishlist_status=WISHLIST_STATUS_READY,
    )
    session.add(wishlist)
    session.flush()
    item = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        item_type=WISHLIST_ITEM_TYPE_GIFT,
        description=description,
        qty_requested=1,
        priority="MEDIUM",
        status=status,
        label_code=f"label-{uuid.uuid4()}",
    )
    session.add(item)
    session.flush()
    sponsorship = (
        session.query(Sponsorship)
        .filter(Sponsorship.campaign_id == campaign_id, Sponsorship.sponsor_id == sponsor.id)
        .one()
    )
    sponsorship_item = SponsorshipItem(
        id=uuid.uuid4(),
        sponsorship_id=sponsorship.id,
        wishlist_item_id=item.id,
        qty_committed=1,
    )
    session.add(sponsorship_item)
    session.flush()
    return item
