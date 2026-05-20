from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import date

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
from app.models.donation import Donation
from app.models.donation_line import DonationLine
from app.models.fulfillment import Fulfillment
from app.models.recipient import Recipient
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


def test_list_campaigns_returns_only_visible_campaigns(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    user = _seed_user(session)
    visible = _seed_campaign(session, year=2026, name="Visible Campaign")
    _seed_campaign(session, year=2026, name="Hidden Campaign")
    _assign_role(session, user, visible, "DONATION_ENTRY")
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
    group = RecipientGroup(id=uuid.uuid4(), campaign_id=campaign.id, group_type="HOUSEHOLD", group_name="Family One")
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=group.id,
        recipient_type="CHILD",
        privacy_level="FULL_NAME",
        display_label="Kid One",
        status="ACTIVE",
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
    assert assignment.role_key == "CAMPAIGN_MANAGER"
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
