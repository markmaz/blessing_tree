from __future__ import annotations

import uuid
from collections.abc import Mapping

from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_validation import parse_bool, require_short_text
from app.models.campaign_member import CampaignMember
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember


class CampaignTeamService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def list_teams(self, db: Session, campaign_id: str) -> list[CampaignTeam]:
        self.campaigns.get_campaign(db, campaign_id)
        return (
            db.query(CampaignTeam)
            .options(
                joinedload(CampaignTeam.memberships).joinedload(
                    CampaignTeamMember.campaign_member
                )
            )
            .filter(CampaignTeam.campaign_id == campaign_id)
            .order_by(CampaignTeam.name.asc())
            .all()
        )

    def create_team(
        self,
        db: Session,
        campaign_id: str,
        payload: Mapping[str, object],
    ) -> CampaignTeam:
        self.campaigns.get_campaign(db, campaign_id)
        name = require_short_text(payload.get("name"), "name")
        existing = self._find_team_by_name(db, campaign_id, name)
        if existing is not None:
            raise ServiceError(
                "Campaign team already exists",
                status_code=409,
                details={"campaign_id": campaign_id, "name": name},
            )

        team = CampaignTeam(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            name=name,
            description=self._optional_description(payload.get("description")),
            is_active=parse_bool(payload.get("is_active"), "is_active", default=True),
        )
        db.add(team)
        db.commit()
        return self._get_team(db, campaign_id, str(team.id))

    def update_team(
        self,
        db: Session,
        campaign_id: str,
        team_id: str,
        payload: Mapping[str, object],
    ) -> CampaignTeam:
        team = self._get_team(db, campaign_id, team_id)
        if "name" in payload:
            name = require_short_text(payload.get("name"), "name")
            existing = self._find_team_by_name(db, campaign_id, name)
            if existing is not None and existing.id != team.id:
                raise ServiceError(
                    "Campaign team already exists",
                    status_code=409,
                    details={"campaign_id": campaign_id, "name": name},
                )
            team.name = name
        if "description" in payload:
            team.description = self._optional_description(payload.get("description"))
        if "is_active" in payload:
            team.is_active = parse_bool(payload.get("is_active"), "is_active")
        db.commit()
        return self._get_team(db, campaign_id, team_id)

    def add_member(
        self,
        db: Session,
        campaign_id: str,
        team_id: str,
        member_id: str,
    ) -> CampaignTeamMember:
        team = self._get_team(db, campaign_id, team_id)
        member = self._get_member(db, campaign_id, member_id)
        existing = (
            db.query(CampaignTeamMember)
            .filter(
                CampaignTeamMember.team_id == team.id,
                CampaignTeamMember.campaign_member_id == member.id,
            )
            .one_or_none()
        )
        if existing is not None:
            raise ServiceError(
                "Campaign team membership already exists",
                status_code=409,
                details={"campaign_id": campaign_id, "team_id": team_id, "member_id": member_id},
            )

        membership = CampaignTeamMember(
            id=uuid.uuid4(),
            team_id=team.id,
            campaign_member_id=member.id,
        )
        db.add(membership)
        db.commit()
        return self._get_membership(db, team.id, member.id)

    def remove_member(
        self,
        db: Session,
        campaign_id: str,
        team_id: str,
        member_id: str,
    ) -> None:
        team = self._get_team(db, campaign_id, team_id)
        member = self._get_member(db, campaign_id, member_id)
        membership = (
            db.query(CampaignTeamMember)
            .filter(
                CampaignTeamMember.team_id == team.id,
                CampaignTeamMember.campaign_member_id == member.id,
            )
            .one_or_none()
        )
        if membership is None:
            raise ServiceError(
                "Campaign team membership not found",
                status_code=404,
                details={"campaign_id": campaign_id, "team_id": team_id, "member_id": member_id},
            )
        db.delete(membership)
        db.commit()

    @staticmethod
    def _optional_description(value: object) -> str | None:
        if value in (None, ""):
            return None
        return require_short_text(value, "description", max_length=5000)

    def _get_team(self, db: Session, campaign_id: str, team_id: str) -> CampaignTeam:
        team_uuid = self._require_uuid(team_id, "team_id")
        team = (
            db.query(CampaignTeam)
            .options(
                joinedload(CampaignTeam.memberships).joinedload(
                    CampaignTeamMember.campaign_member
                )
            )
            .filter(CampaignTeam.campaign_id == campaign_id, CampaignTeam.id == team_uuid)
            .one_or_none()
        )
        if team is None:
            raise ServiceError(
                "Campaign team not found",
                status_code=404,
                details={"campaign_id": campaign_id, "team_id": team_id},
            )
        return team

    def _get_member(self, db: Session, campaign_id: str, member_id: str) -> CampaignMember:
        member_uuid = self._require_uuid(member_id, "member_id")
        member = (
            db.query(CampaignMember)
            .filter(CampaignMember.campaign_id == campaign_id, CampaignMember.id == member_uuid)
            .one_or_none()
        )
        if member is None:
            raise ServiceError(
                "Campaign member not found",
                status_code=404,
                details={"campaign_id": campaign_id, "member_id": member_id},
            )
        return member

    @staticmethod
    def _get_membership(
        db: Session,
        team_id: uuid.UUID,
        member_id: uuid.UUID,
    ) -> CampaignTeamMember:
        membership = (
            db.query(CampaignTeamMember)
            .options(
                joinedload(CampaignTeamMember.team),
                joinedload(CampaignTeamMember.campaign_member),
            )
            .filter(
                CampaignTeamMember.team_id == team_id,
                CampaignTeamMember.campaign_member_id == member_id,
            )
            .one()
        )
        return membership

    def _find_team_by_name(
        self,
        db: Session,
        campaign_id: str,
        name: str,
    ) -> CampaignTeam | None:
        return (
            db.query(CampaignTeam)
            .filter(CampaignTeam.campaign_id == campaign_id, CampaignTeam.name == name)
            .one_or_none()
        )

    @staticmethod
    def _require_uuid(value: str, field_name: str) -> uuid.UUID:
        try:
            return uuid.UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            raise ServiceError(
                f"Valid {field_name} is required",
                status_code=400,
                details={"field": field_name},
            )
