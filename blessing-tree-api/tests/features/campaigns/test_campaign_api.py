from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import date, datetime

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
from app.features.campaigns.api import campaign_ns
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.models.app_user import AppUser
from app.models.base import Base
from app.models.campaign import Campaign
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_event import CampaignEvent
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember
from app.models.campaign_team_role import CampaignTeamRole
from app.models.communication_template import CommunicationTemplate
from app.models.donation import Donation
from app.models.donation_line import DonationLine
from app.models.fulfillment import Fulfillment
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
)
from app.models.recipient_group import RecipientGroup
from app.models.sponsor import Sponsor
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


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


def _seed_user(db: Session, *, role: str = "VOLUNTEER") -> AppUser:
    user = AppUser(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        display_name="Test User",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _seed_campaign(db: Session, *, year: int, name: str, status: str = "ACTIVE", description: str | None = None) -> Campaign:
    campaign = Campaign(
        id=uuid.uuid4(),
        name=name,
        description=description,
        season_theme="Grace & Renewal",
        year=year,
        start_date=date(year, 11, 1),
        end_date=date(year, 12, 31),
        status=status,
    )
    db.add(campaign)
    db.flush()
    return campaign


def _assign_role(db: Session, user: AppUser, campaign: Campaign, role_key: str) -> None:
    db.add(
        CampaignUserRole(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            user_id=user.id,
            role_key=role_key,
            is_active=True,
        )
    )
    db.flush()


def _assign_member_access_role(db: Session, user: AppUser, campaign: Campaign, role_key: str) -> None:
    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name=user.display_name,
        email=user.email,
        member_type="staff",
        app_user_id=user.id,
        app_access_status="active",
        is_active=True,
    )
    db.add(member)
    db.flush()
    db.add(
        CampaignMemberAccessRole(
            id=uuid.uuid4(),
            campaign_member_id=member.id,
            role_key=role_key,
            is_active=True,
        )
    )
    db.flush()


def test_list_campaigns_returns_only_visible_campaigns(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    user = _seed_user(session)
    visible = _seed_campaign(session, year=2026, name="Visible Campaign")
    _seed_campaign(session, year=2026, name="Hidden Campaign")
    _assign_member_access_role(session, user, visible, "DONATION_ENTRY")
    user_id = str(user.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get("/api/v1/campaigns", headers=_auth_header(user_id, "VOLUNTEER"))

    assert response.status_code == 200
    payload = response.get_json()
    assert [item["name"] for item in payload] == ["Visible Campaign"]
    assert payload[0]["user_access"]["role_keys"] == ["DONATION_ENTRY"]


def test_get_campaign_summary_returns_all_v1_counts(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    user = _seed_user(session)
    campaign = _seed_campaign(session, year=2026, name="Summary Campaign")
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Family One",
        status="ACTIVE",
    )
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_CHILD,
        program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
        display_label="Kid One",
        status=RECIPIENT_STATUS_ACTIVE,
    )
    wishlist = Wishlist(id=uuid.uuid4(), campaign_id=campaign.id, recipient_id=recipient.id)
    wishlist_item = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        description="Toy Truck",
        qty_requested=1,
        priority="MEDIUM",
        allow_substitute=True,
        status="OPEN",
        qty_fulfilled=0,
        label_code="label-1",
        label_version=1,
    )
    donation = Donation(id=uuid.uuid4(), campaign_id=campaign.id, source="DROP_OFF")
    donation_line = DonationLine(id=uuid.uuid4(), donation_id=donation.id, description="Toy Truck", quantity=1, status="UNASSIGNED")
    sponsor = Sponsor(id=uuid.uuid4(), display_name="Sponsor One", preferred_contact="NONE", is_active=True)
    sponsorship = Sponsorship(id=uuid.uuid4(), campaign_id=campaign.id, sponsor_id=sponsor.id, status="ACTIVE")
    sponsorship_item = SponsorshipItem(id=uuid.uuid4(), sponsorship_id=sponsorship.id, wishlist_item_id=wishlist_item.id, qty_committed=1)
    fulfillment = Fulfillment(id=uuid.uuid4(), wishlist_item_id=wishlist_item.id, donation_line_id=donation_line.id, quantity_fulfilled=1)

    session.add_all([group, recipient, wishlist, wishlist_item, donation, donation_line, sponsor, sponsorship, sponsorship_item, fulfillment])
    _assign_role(session, user, campaign, "CAMPAIGN_MANAGER")
    user_id = str(user.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/summary",
        headers=_auth_header(user_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    counts = response.get_json()["counts"]
    assert counts == {
        "recipient_groups": 1,
        "recipients": 1,
        "wishlists": 1,
        "wishlist_items": 1,
        "donations": 1,
        "sponsorships": 1,
        "sponsorship_items": 1,
        "fulfillments": 1,
        "pickups": 0,
    }


def test_campaign_detail_serializes_season_theme(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    user = _seed_user(session)
    campaign = _seed_campaign(session, year=2026, name="Theme Campaign")
    _assign_role(session, user, campaign, "CAMPAIGN_MANAGER")
    user_id = str(user.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}",
        headers=_auth_header(user_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["season_theme"] == "Grace & Renewal"


def test_season_reflection_avoids_recent_pair_ids(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    user = _seed_user(session)
    campaign = _seed_campaign(session, year=2026, name="Reflection Campaign")
    _assign_role(session, user, campaign, "CAMPAIGN_MANAGER")
    user_id = str(user.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    first_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/season-reflection",
        headers=_auth_header(user_id, "VOLUNTEER"),
    )
    assert first_response.status_code == 200
    first_payload = first_response.get_json()

    second_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/season-reflection?exclude_pair_ids={first_payload['pair_id']}",
        headers=_auth_header(user_id, "VOLUNTEER"),
    )
    assert second_response.status_code == 200
    second_payload = second_response.get_json()
    assert second_payload["pair_id"] != first_payload["pair_id"]


def test_create_campaign_allows_duplicate_year_and_creates_manager_assignment(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    admin = _seed_user(session, role="ADMIN")
    _seed_campaign(session, year=2026, name="Existing 2026")
    admin_id = str(admin.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        "/api/v1/campaigns",
        json={
            "name": "Second 2026 Campaign",
            "year": 2026,
            "description": "Second campaign in same year",
            "status": "DRAFT",
        },
        headers=_auth_header(admin_id, "ADMIN"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["year"] == 2026
    assert payload["description"] == "Second campaign in same year"

    verify = campaign_api_module.SessionLocal()
    created = verify.query(Campaign).filter(Campaign.id == payload["id"]).one()
    assignment = (
        verify.query(CampaignUserRole)
        .filter(CampaignUserRole.campaign_id == created.id, CampaignUserRole.user_id == admin_id)
        .one()
    )
    creator_member = (
        verify.query(CampaignMember)
        .filter(CampaignMember.campaign_id == created.id, CampaignMember.app_user_id == admin_id)
        .one()
    )
    creator_access_role = (
        verify.query(CampaignMemberAccessRole)
        .filter(
            CampaignMemberAccessRole.campaign_member_id == creator_member.id,
            CampaignMemberAccessRole.role_key == "CAMPAIGN_MANAGER",
        )
        .one()
    )
    assert assignment.role_key == "CAMPAIGN_MANAGER"
    assert creator_member.app_access_status == "active"
    assert bool(creator_access_role.is_active) is True
    verify.close()


def test_create_campaign_from_source_clones_campaign_setup(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    admin = _seed_user(session, role="ADMIN")
    volunteer = _seed_user(session, role="VOLUNTEER")
    source_campaign = _seed_campaign(
        session,
        year=2026,
        name="Blessing Tree 2026",
        description="Original season",
    )
    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=source_campaign.id,
        display_name="Volunteer One",
        email="volunteer@example.com",
        member_type="volunteer",
        app_user_id=volunteer.id,
        app_access_status="active",
        is_active=True,
    )
    session.add(member)
    session.flush()
    source_admin_member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=source_campaign.id,
        display_name="Admin Member",
        email=admin.email,
        member_type="staff",
        app_user_id=admin.id,
        app_access_status="active",
        is_active=True,
    )
    session.add(source_admin_member)
    session.flush()
    session.add(
        CampaignMemberAccessRole(
            id=uuid.uuid4(),
            campaign_member_id=member.id,
            role_key="VOLUNTEER_VIEWER",
            is_active=True,
        )
    )
    session.add(
        CampaignMemberAccessRole(
            id=uuid.uuid4(),
            campaign_member_id=source_admin_member.id,
            role_key="CAMPAIGN_MANAGER",
            is_active=True,
        )
    )
    team = CampaignTeam(
        id=uuid.uuid4(),
        campaign_id=source_campaign.id,
        name="Warehouse Crew",
        description="Handles gift sorting",
        is_active=True,
    )
    session.add(team)
    session.flush()
    team_role = CampaignTeamRole(
        id=uuid.uuid4(),
        team_id=team.id,
        name="Check In",
        description="Checks in gifts",
        sort_order=1,
        is_active=True,
    )
    session.add(team_role)
    session.flush()
    session.add(
        CampaignTeamMember(
            id=uuid.uuid4(),
            team_id=team.id,
            campaign_member_id=member.id,
            team_role_id=team_role.id,
        )
    )
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=source_campaign.id,
        template_key="volunteer_reminder",
        name="Volunteer Reminder",
        audience="VOLUNTEER",
        channel="EMAIL",
        subject_template="Reminder",
        body_template="Please arrive on time.",
        is_active=True,
        created_by_user_id=admin.id,
    )
    session.add(template)
    milestone = CampaignMilestone(
        id=uuid.uuid4(),
        campaign_id=source_campaign.id,
        milestone_key="registration_open",
        label="Registration Opens",
        occurs_on=date(2026, 9, 15),
        notes="Open enrollment",
        sort_order=1,
    )
    session.add(milestone)
    session.flush()
    session.add(
        CampaignCommunicationSchedule(
            id=uuid.uuid4(),
            campaign_id=source_campaign.id,
            template_id=template.id,
            milestone_key="registration_open",
            scheduled_for=None,
            status="SCHEDULED",
            notes="Send on open",
        )
    )
    session.add(
        CampaignEvent(
            id=uuid.uuid4(),
            campaign_id=source_campaign.id,
            title="Volunteer Orientation",
            event_type="VOLUNTEER",
            start_at=datetime(2026, 10, 1, 18, 0, 0),
            end_at=datetime(2026, 10, 1, 19, 30, 0),
            all_day=False,
            notes="Training night",
            source_type="manual",
            source_id=None,
            created_by_user_id=admin.id,
        )
    )
    admin_id = str(admin.id)
    source_campaign_id = str(source_campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        "/api/v1/campaigns",
        json={
            "name": "Blessing Tree 2027",
            "year": 2027,
            "status": "DRAFT",
            "source_campaign_id": source_campaign_id,
        },
        headers=_auth_header(admin_id, "ADMIN"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["start_date"] == "2027-11-01"
    assert payload["end_date"] == "2027-12-31"

    verify = campaign_api_module.SessionLocal()
    created = verify.query(Campaign).filter(Campaign.id == payload["id"]).one()
    cloned_member = (
        verify.query(CampaignMember)
        .filter(
            CampaignMember.campaign_id == created.id,
            CampaignMember.display_name == "Volunteer One",
        )
        .one()
    )
    cloned_access_role = (
        verify.query(CampaignMemberAccessRole)
        .filter(CampaignMemberAccessRole.campaign_member_id == cloned_member.id)
        .one()
    )
    creator_member = (
        verify.query(CampaignMember)
        .filter(CampaignMember.campaign_id == created.id, CampaignMember.app_user_id == admin_id)
        .one()
    )
    creator_member_count = (
        verify.query(CampaignMember)
        .filter(CampaignMember.campaign_id == created.id, CampaignMember.app_user_id == admin_id)
        .count()
    )
    cloned_team = verify.query(CampaignTeam).filter(CampaignTeam.campaign_id == created.id).one()
    cloned_team_role = verify.query(CampaignTeamRole).filter(CampaignTeamRole.team_id == cloned_team.id).one()
    cloned_team_membership = (
        verify.query(CampaignTeamMember)
        .filter(CampaignTeamMember.team_id == cloned_team.id, CampaignTeamMember.campaign_member_id == cloned_member.id)
        .one()
    )
    cloned_template = verify.query(CommunicationTemplate).filter(CommunicationTemplate.campaign_id == created.id).one()
    cloned_schedule = (
        verify.query(CampaignCommunicationSchedule)
        .filter(CampaignCommunicationSchedule.campaign_id == created.id)
        .one()
    )
    cloned_milestone = verify.query(CampaignMilestone).filter(CampaignMilestone.campaign_id == created.id).one()
    cloned_event = verify.query(CampaignEvent).filter(CampaignEvent.campaign_id == created.id).one()

    assert cloned_member.display_name == "Volunteer One"
    assert cloned_access_role.role_key == "VOLUNTEER_VIEWER"
    assert cloned_team.name == "Warehouse Crew"
    assert cloned_team_role.name == "Check In"
    assert cloned_team_membership.team_role_id == cloned_team_role.id
    assert cloned_template.name == "Volunteer Reminder (2027)"
    assert cloned_schedule.template_id == cloned_template.id
    assert cloned_schedule.status == "DRAFT"
    assert cloned_milestone.occurs_on == date(2027, 9, 15)
    assert cloned_event.start_at == datetime(2027, 10, 1, 18, 0, 0)
    assert creator_member_count == 1
    assert creator_member.display_name == "Admin Member"
    verify.close()


def test_patch_campaign_allows_manager_status_transition(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    user = _seed_user(session)
    campaign = _seed_campaign(session, year=2026, name="Draft Campaign", status="DRAFT")
    _assign_role(session, user, campaign, "CAMPAIGN_MANAGER")
    user_id = str(user.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.patch(
        f"/api/v1/campaigns/{campaign_id}",
        json={"status": "ACTIVE", "description": "Now live"},
        headers=_auth_header(user_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ACTIVE"
    assert payload["description"] == "Now live"


def test_missing_campaign_returns_404_from_campaign_decorator(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    user = _seed_user(session, role="ADMIN")
    user_id = str(user.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{uuid.uuid4()}/summary",
        headers=_auth_header(user_id, "ADMIN"),
    )

    assert response.status_code == 404
