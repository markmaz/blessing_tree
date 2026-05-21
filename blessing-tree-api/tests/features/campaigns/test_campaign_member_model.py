from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.models.campaign_member_constants import (
    APP_ACCESS_STATUS_LINKED,
    APP_ACCESS_STATUS_NONE,
    CAMPAIGN_MEMBER_TYPE_CONTACT,
    CAMPAIGN_MEMBER_TYPE_VOLUNTEER,
)
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
from app.models.base import Base
from app.models.campaign import Campaign
from app.models.campaign_member import CampaignMember


@compiles(TINYINT, "sqlite")
def _compile_tinyint_sqlite(_type, _compiler, **_kwargs) -> str:
    return "INTEGER"


def _build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[
            AppUser.__table__,
            AuthIdentity.__table__,
            Campaign.__table__,
            CampaignMember.__table__,
        ],
    )
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)()


def _create_campaign() -> Campaign:
    return Campaign(
        id=uuid.uuid4(),
        name="Blessing Tree 2026",
        year=2026,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 12, 31),
        status="ACTIVE",
    )


def _create_user() -> AppUser:
    return AppUser(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        display_name="Linked User",
        role="VOLUNTEER",
        is_active=True,
    )


def test_campaign_member_supports_roster_only_members() -> None:
    db = _build_session()
    campaign = _create_campaign()
    db.add(campaign)
    db.flush()

    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name="Warehouse Volunteer",
        email="warehouse@example.com",
        member_type=CAMPAIGN_MEMBER_TYPE_VOLUNTEER,
        app_access_status=APP_ACCESS_STATUS_NONE,
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    db.refresh(campaign)

    assert member.app_user_id is None
    assert member.app_user is None
    assert member.member_type == CAMPAIGN_MEMBER_TYPE_VOLUNTEER
    assert member.app_access_status == APP_ACCESS_STATUS_NONE
    assert campaign.campaign_members[0].display_name == "Warehouse Volunteer"
    db.close()


def test_campaign_member_links_to_app_user_and_campaign_relationships() -> None:
    db = _build_session()
    campaign = _create_campaign()
    user = _create_user()
    db.add_all([campaign, user])
    db.flush()

    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name="Gift Coordinator",
        email=user.email,
        phone="555-1212",
        notes="Handles sponsor callbacks too.",
        member_type=CAMPAIGN_MEMBER_TYPE_CONTACT,
        app_user_id=user.id,
        app_access_status=APP_ACCESS_STATUS_LINKED,
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    db.refresh(campaign)
    db.refresh(user)

    assert member.app_user_id == user.id
    assert member.app_user is not None
    assert member.app_user.email == user.email
    assert campaign.campaign_members[0].id == member.id
    assert user.campaign_members[0].id == member.id
    db.close()


def test_campaign_member_enforces_one_linked_app_user_per_campaign() -> None:
    db = _build_session()
    campaign = _create_campaign()
    user = _create_user()
    db.add_all([campaign, user])
    db.flush()

    db.add(
        CampaignMember(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            display_name="Primary Member",
            app_user_id=user.id,
            app_access_status=APP_ACCESS_STATUS_LINKED,
            is_active=True,
        )
    )
    db.flush()

    db.add(
        CampaignMember(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            display_name="Duplicate Member",
            app_user_id=user.id,
            app_access_status=APP_ACCESS_STATUS_LINKED,
            is_active=True,
        )
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    else:
        raise AssertionError("Expected unique campaign/app_user constraint to fail")
    finally:
        db.close()
