from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.exceptions.service_error import ServiceError
from app.features.campaigns.team_service import CampaignTeamService
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
from app.models.base import Base
from app.models.campaign import Campaign
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_constants import APP_ACCESS_STATUS_NONE
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember
from app.models.campaign_team_role import CampaignTeamRole


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
            CampaignTeam.__table__,
            CampaignTeamRole.__table__,
            CampaignTeamMember.__table__,
        ],
    )
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)()


def _create_campaign(year: int = 2026) -> Campaign:
    return Campaign(
        id=uuid.uuid4(),
        name=f"Blessing Tree {year}",
        year=year,
        start_date=date(year, 11, 1),
        end_date=date(year, 12, 31),
        status="ACTIVE",
    )


def _create_member(campaign_id: uuid.UUID, name: str) -> CampaignMember:
    return CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        display_name=name,
        email=f"{name.lower().replace(' ', '.')}@example.com",
        app_access_status=APP_ACCESS_STATUS_NONE,
        is_active=True,
    )


def test_create_team_and_list_teams() -> None:
    db = _build_session()
    campaign = _create_campaign()
    db.add(campaign)
    db.commit()
    service = CampaignTeamService()

    created = service.create_team(
        db,
        str(campaign.id),
        {"name": "Sponsor Callers", "description": "Outbound sponsor follow-up"},
    )
    teams = service.list_teams(db, str(campaign.id))

    assert created.name == "Sponsor Callers"
    assert created.description == "Outbound sponsor follow-up"
    assert len(teams) == 1
    assert teams[0].name == "Sponsor Callers"
    db.close()


def test_create_team_rejects_duplicate_name_in_campaign() -> None:
    db = _build_session()
    campaign = _create_campaign()
    db.add(campaign)
    db.commit()
    service = CampaignTeamService()
    service.create_team(db, str(campaign.id), {"name": "Warehouse Crew"})

    try:
        service.create_team(db, str(campaign.id), {"name": "Warehouse Crew"})
    except ServiceError as error:
        assert error.status_code == 409
        assert error.details["name"] == "Warehouse Crew"
    else:
        raise AssertionError("Expected duplicate team name to be rejected")
    finally:
        db.close()


def test_update_team_changes_name_and_active_flag() -> None:
    db = _build_session()
    campaign = _create_campaign()
    db.add(campaign)
    db.commit()
    service = CampaignTeamService()
    team = service.create_team(db, str(campaign.id), {"name": "Pickup Team"})

    updated = service.update_team(
        db,
        str(campaign.id),
        str(team.id),
        {"name": "Pickup Weekend Team", "is_active": False},
    )

    assert updated.name == "Pickup Weekend Team"
    assert bool(updated.is_active) is False
    db.close()


def test_add_and_remove_team_member() -> None:
    db = _build_session()
    campaign = _create_campaign()
    member = _create_member(campaign.id, "Alex Volunteer")
    db.add_all([campaign, member])
    db.commit()
    service = CampaignTeamService()
    team = service.create_team(db, str(campaign.id), {"name": "Gift Coordinators"})

    membership = service.add_member(db, str(campaign.id), str(team.id), str(member.id))

    assert membership.team_id == team.id
    assert membership.campaign_member_id == member.id
    assert service.list_teams(db, str(campaign.id))[0].memberships[0].campaign_member.id == member.id

    service.remove_member(db, str(campaign.id), str(team.id), str(member.id))

    assert service.list_teams(db, str(campaign.id))[0].memberships == []
    db.close()


def test_team_roles_and_role_less_membership() -> None:
    db = _build_session()
    campaign = _create_campaign()
    member = _create_member(campaign.id, "Casey Caller")
    db.add_all([campaign, member])
    db.commit()
    service = CampaignTeamService()
    team = service.create_team(db, str(campaign.id), {"name": "Phone Bank"})

    role = service.create_role(
        db,
        str(campaign.id),
        str(team.id),
        {"name": "Lead", "description": "Coordinates the team"},
    )
    membership = service.add_member(
        db,
        str(campaign.id),
        str(team.id),
        str(member.id),
        str(role.id),
    )

    assert membership.team_role_id == role.id
    assert membership.team_role is not None
    assert membership.team_role.name == "Lead"

    updated_membership = service.update_member_role(
        db,
        str(campaign.id),
        str(team.id),
        str(member.id),
        None,
    )

    assert updated_membership.team_role_id is None
    assert updated_membership.team_role is None
    db.close()


def test_add_member_rejects_member_from_other_campaign() -> None:
    db = _build_session()
    campaign = _create_campaign(2026)
    other_campaign = _create_campaign(2027)
    member = _create_member(other_campaign.id, "Taylor Other")
    db.add_all([campaign, other_campaign, member])
    db.commit()
    service = CampaignTeamService()
    team = service.create_team(db, str(campaign.id), {"name": "Family Intake"})

    try:
        service.add_member(db, str(campaign.id), str(team.id), str(member.id))
    except ServiceError as error:
        assert error.status_code == 404
        assert error.details["member_id"] == str(member.id)
    else:
        raise AssertionError("Expected cross-campaign member assignment to fail")
    finally:
        db.close()
