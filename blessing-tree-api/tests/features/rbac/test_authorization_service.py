from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

from app.models.campaign_member_constants import (
    APP_ACCESS_STATUS_ACTIVE,
    APP_ACCESS_STATUS_LINKED,
)
from app.features.rbac.constants import (
    ALL_CAMPAIGN_CAPABILITIES,
    APP_ADMIN_ROLE,
    APP_USER_ROLE,
    CAMPAIGN_DONATIONS_EDIT_CAPABILITY,
    CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY,
    DONATION_ENTRY_ROLE,
    GIFT_CHECKIN_ROLE,
    normalize_app_role,
)
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.features.rbac.services.authorization_service import AuthorizationService
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
from app.models.campaign import Campaign
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.base import Base
import app.models.models  # noqa: F401


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
            CampaignUserRole.__table__,
            CampaignMember.__table__,
            CampaignMemberAccessRole.__table__,
        ],
    )
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)()


def _create_user(role: str, *, is_active: bool = True) -> AppUser:
    return AppUser(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        display_name="Test User",
        role=role,
        is_active=is_active,
    )


def _create_campaign() -> Campaign:
    return Campaign(
        id=uuid.uuid4(),
        name="2026 Blessing Tree",
        year=2026,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 12, 31),
        status="ACTIVE",
    )


def test_normalize_app_role_maps_legacy_values() -> None:
    assert normalize_app_role("ADMIN") == APP_ADMIN_ROLE
    assert normalize_app_role("COORDINATOR") == APP_USER_ROLE
    assert normalize_app_role("VOLUNTEER") == APP_USER_ROLE
    assert normalize_app_role("APP_ADMIN") == APP_ADMIN_ROLE
    assert normalize_app_role(None) == APP_USER_ROLE


def test_get_campaign_capabilities_unions_multiple_active_roles() -> None:
    db = _build_session()
    service = AuthorizationService()
    user = _create_user("VOLUNTEER")
    campaign = _create_campaign()
    db.add_all([user, campaign])
    db.flush()
    db.add_all(
        [
            CampaignUserRole(
                id=uuid.uuid4(),
                user_id=user.id,
                campaign_id=campaign.id,
                role_key=DONATION_ENTRY_ROLE,
                is_active=True,
            ),
            CampaignUserRole(
                id=uuid.uuid4(),
                user_id=user.id,
                campaign_id=campaign.id,
                role_key=GIFT_CHECKIN_ROLE.lower(),
                is_active=True,
            ),
            CampaignUserRole(
                id=uuid.uuid4(),
                user_id=user.id,
                campaign_id=campaign.id,
                role_key="VOLUNTEER_VIEWER",
                is_active=False,
            ),
        ]
    )
    db.commit()

    capabilities = service.get_campaign_capabilities(db, user.id, campaign.id)

    assert CAMPAIGN_DONATIONS_EDIT_CAPABILITY in capabilities
    assert CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY in capabilities
    assert service.user_has_campaign_capability(db, user.id, campaign.id, CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY)
    db.close()


def test_get_campaign_capabilities_unions_member_and_direct_user_roles() -> None:
    db = _build_session()
    service = AuthorizationService()
    user = _create_user("VOLUNTEER")
    campaign = _create_campaign()
    db.add_all([user, campaign])
    db.flush()

    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name=user.display_name,
        email=user.email,
        app_user_id=user.id,
        app_access_status=APP_ACCESS_STATUS_ACTIVE,
        is_active=True,
    )
    db.add(member)
    db.flush()
    db.add(
        CampaignMemberAccessRole(
            id=uuid.uuid4(),
            campaign_member_id=member.id,
            role_key=GIFT_CHECKIN_ROLE,
            is_active=True,
        )
    )
    db.add(
        CampaignUserRole(
            id=uuid.uuid4(),
            user_id=user.id,
            campaign_id=campaign.id,
            role_key=DONATION_ENTRY_ROLE,
            is_active=True,
        )
    )
    db.commit()

    capabilities = service.get_campaign_capabilities(db, user.id, campaign.id)

    assert CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY in capabilities
    assert CAMPAIGN_DONATIONS_EDIT_CAPABILITY in capabilities
    db.close()


def test_get_campaign_capabilities_falls_back_to_legacy_roles_without_member_link() -> None:
    db = _build_session()
    service = AuthorizationService()
    user = _create_user("VOLUNTEER")
    campaign = _create_campaign()
    db.add_all([user, campaign])
    db.flush()
    db.add(
        CampaignUserRole(
            id=uuid.uuid4(),
            user_id=user.id,
            campaign_id=campaign.id,
            role_key=DONATION_ENTRY_ROLE,
            is_active=True,
        )
    )
    db.commit()

    capabilities = service.get_campaign_capabilities(db, user.id, campaign.id)

    assert CAMPAIGN_DONATIONS_EDIT_CAPABILITY in capabilities
    db.close()


def test_get_campaign_capabilities_ignores_non_active_member_access_status() -> None:
    db = _build_session()
    service = AuthorizationService()
    user = _create_user("VOLUNTEER")
    campaign = _create_campaign()
    db.add_all([user, campaign])
    db.flush()

    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name=user.display_name,
        email=user.email,
        app_user_id=user.id,
        app_access_status=APP_ACCESS_STATUS_LINKED,
        is_active=True,
    )
    db.add(member)
    db.flush()
    db.add(
        CampaignMemberAccessRole(
            id=uuid.uuid4(),
            campaign_member_id=member.id,
            role_key=GIFT_CHECKIN_ROLE,
            is_active=True,
        )
    )
    db.commit()

    capabilities = service.get_campaign_capabilities(db, user.id, campaign.id)

    assert capabilities == set()
    db.close()


def test_app_admin_receives_all_campaign_capabilities() -> None:
    db = _build_session()
    service = AuthorizationService()
    user = _create_user("ADMIN")
    campaign = _create_campaign()
    db.add_all([user, campaign])
    db.commit()

    capabilities = service.get_campaign_capabilities(db, user.id, campaign.id)

    assert capabilities == set(ALL_CAMPAIGN_CAPABILITIES)
    db.close()


def test_inactive_user_receives_no_campaign_capabilities() -> None:
    db = _build_session()
    service = AuthorizationService()
    user = _create_user("ADMIN", is_active=False)
    campaign = _create_campaign()
    db.add_all([user, campaign])
    db.commit()

    capabilities = service.get_campaign_capabilities(db, user.id, campaign.id)

    assert capabilities == set()
    db.close()
