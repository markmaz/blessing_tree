from __future__ import annotations

import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.team_validation import (
    APP_ACCESS_STATUS_NONE,
    parse_bool,
    require_access_role_assignment_id,
    require_app_user_id,
    require_member_id,
    require_team_id,
    require_short_text,
    validate_app_access_status,
    validate_invite_status,
    validate_link_status,
    validate_member_type,
    validate_optional_email,
    validate_optional_notes,
    validate_optional_phone,
    validate_role_key,
)
from app.models.app_user import AppUser
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.campaign_team_member import CampaignTeamMember


class CampaignMemberService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def list_members(
        self,
        db: Session,
        campaign_id: str,
        *,
        search: str | None = None,
        app_access_status: str | None = None,
        role_key: str | None = None,
        team_id: str | None = None,
        is_active: bool | None = None,
    ) -> list[CampaignMember]:
        self.campaigns.get_campaign(db, campaign_id)
        query = (
            db.query(CampaignMember)
            .options(
                joinedload(CampaignMember.app_user),
                joinedload(CampaignMember.access_roles),
                joinedload(CampaignMember.team_memberships).joinedload(CampaignTeamMember.team),
                joinedload(CampaignMember.team_memberships).joinedload(CampaignTeamMember.team_role),
            )
            .filter(CampaignMember.campaign_id == campaign_id)
        )

        if search:
            pattern = f"%{str(search).strip().lower()}%"
            query = query.filter(
                func.lower(CampaignMember.display_name).like(pattern)
                | func.lower(func.coalesce(CampaignMember.email, "")).like(pattern)
            )
        if app_access_status:
            query = query.filter(
                CampaignMember.app_access_status == validate_app_access_status(app_access_status)
            )
        if role_key:
            query = query.join(CampaignMemberAccessRole).filter(
                CampaignMemberAccessRole.role_key == validate_role_key(role_key)
            )
        if team_id:
            query = query.join(CampaignTeamMember).filter(
                CampaignTeamMember.team_id == require_team_id(team_id)
            )
        if is_active is not None:
            query = query.filter(CampaignMember.is_active == int(is_active))

        return query.distinct().order_by(CampaignMember.display_name.asc()).all()

    def create_member(
        self,
        db: Session,
        campaign_id: str,
        payload: dict[str, object],
    ) -> CampaignMember:
        self.campaigns.get_campaign(db, campaign_id)
        member = CampaignMember(
            id=uuid.uuid4(),
            campaign_id=uuid.UUID(campaign_id),
            display_name=require_short_text(payload.get("display_name"), "display_name"),
            email=validate_optional_email(payload.get("email")),
            phone=validate_optional_phone(payload.get("phone")),
            notes=validate_optional_notes(payload.get("notes")),
            member_type=validate_member_type(payload.get("member_type")),
            app_access_status=validate_app_access_status(payload.get("app_access_status") or APP_ACCESS_STATUS_NONE),
            is_active=parse_bool(payload.get("is_active"), "is_active", default=True),
        )
        if "app_user_id" in payload and payload.get("app_user_id") not in (None, ""):
            user = self._get_app_user(db, payload.get("app_user_id"))
            self._ensure_campaign_user_link_available(db, campaign_id, user.id)
            member.app_user_id = user.id
        db.add(member)
        db.commit()
        return self.get_member(db, campaign_id, str(member.id))

    def get_member(self, db: Session, campaign_id: str, member_id: str) -> CampaignMember:
        self.campaigns.get_campaign(db, campaign_id)
        member_uuid = require_member_id(member_id)
        member = (
            db.query(CampaignMember)
            .options(
                joinedload(CampaignMember.app_user),
                joinedload(CampaignMember.access_roles),
                joinedload(CampaignMember.team_memberships).joinedload(CampaignTeamMember.team),
                joinedload(CampaignMember.team_memberships).joinedload(CampaignTeamMember.team_role),
            )
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

    def update_member(
        self,
        db: Session,
        campaign_id: str,
        member_id: str,
        payload: dict[str, object],
    ) -> CampaignMember:
        member = self.get_member(db, campaign_id, member_id)
        if "display_name" in payload:
            member.display_name = require_short_text(payload.get("display_name"), "display_name")
        if "email" in payload:
            member.email = validate_optional_email(payload.get("email"))
        if "phone" in payload:
            member.phone = validate_optional_phone(payload.get("phone"))
        if "notes" in payload:
            member.notes = validate_optional_notes(payload.get("notes"))
        if "member_type" in payload:
            member.member_type = validate_member_type(payload.get("member_type"))
        if "app_access_status" in payload:
            member.app_access_status = validate_app_access_status(payload.get("app_access_status"))
        if "is_active" in payload:
            member.is_active = parse_bool(payload.get("is_active"), "is_active")
        db.commit()
        return self.get_member(db, campaign_id, member_id)

    def list_access_roles(self, db: Session, campaign_id: str) -> list[CampaignMemberAccessRole]:
        self.campaigns.get_campaign(db, campaign_id)
        return (
            db.query(CampaignMemberAccessRole)
            .join(CampaignMember)
            .options(
                joinedload(CampaignMemberAccessRole.campaign_member).joinedload(CampaignMember.app_user)
            )
            .filter(CampaignMember.campaign_id == campaign_id)
            .order_by(CampaignMember.display_name.asc(), CampaignMemberAccessRole.role_key.asc())
            .all()
        )

    def create_access_role(
        self,
        db: Session,
        campaign_id: str,
        member_id: str,
        payload: dict[str, object],
    ) -> CampaignMemberAccessRole:
        member = self.get_member(db, campaign_id, member_id)
        role_key = validate_role_key(payload.get("role_key"))
        existing = (
            db.query(CampaignMemberAccessRole)
            .filter(
                CampaignMemberAccessRole.campaign_member_id == member.id,
                CampaignMemberAccessRole.role_key == role_key,
            )
            .one_or_none()
        )
        if existing is not None:
            raise ServiceError(
                "Campaign member access role already exists",
                status_code=409,
                details={"campaign_id": campaign_id, "member_id": member_id, "role_key": role_key},
            )
        assignment = CampaignMemberAccessRole(
            id=uuid.uuid4(),
            campaign_member_id=member.id,
            role_key=role_key,
            is_active=parse_bool(payload.get("is_active"), "is_active", default=True),
        )
        db.add(assignment)
        db.commit()
        return self._get_access_role(db, member.id, str(assignment.id))

    def update_access_role(
        self,
        db: Session,
        campaign_id: str,
        member_id: str,
        assignment_id: str,
        payload: dict[str, object],
    ) -> CampaignMemberAccessRole:
        member = self.get_member(db, campaign_id, member_id)
        assignment = self._get_access_role(db, member.id, assignment_id)
        if "role_key" in payload:
            role_key = validate_role_key(payload.get("role_key"))
            duplicate = (
                db.query(CampaignMemberAccessRole)
                .filter(
                    CampaignMemberAccessRole.campaign_member_id == member.id,
                    CampaignMemberAccessRole.role_key == role_key,
                    CampaignMemberAccessRole.id != assignment.id,
                )
                .one_or_none()
            )
            if duplicate is not None:
                raise ServiceError(
                    "Campaign member access role already exists",
                    status_code=409,
                    details={"campaign_id": campaign_id, "member_id": member_id, "role_key": role_key},
                )
            assignment.role_key = role_key
        if "is_active" in payload:
            assignment.is_active = parse_bool(payload.get("is_active"), "is_active")
        db.commit()
        return self._get_access_role(db, member.id, assignment_id)

    def link_app_user(
        self,
        db: Session,
        campaign_id: str,
        member_id: str,
        payload: dict[str, object],
    ) -> CampaignMember:
        member = self.get_member(db, campaign_id, member_id)
        user = self._get_app_user(db, payload.get("user_id"))
        self._ensure_campaign_user_link_available(db, campaign_id, user.id, current_member_id=member.id)
        member.app_user_id = user.id
        member.app_access_status = validate_link_status(payload.get("app_access_status"))
        if member.email is None:
            member.email = user.email
        db.commit()
        return self.get_member(db, campaign_id, member_id)

    def invite_app_access(
        self,
        db: Session,
        campaign_id: str,
        member_id: str,
        payload: dict[str, object],
    ) -> CampaignMember:
        member = self.get_member(db, campaign_id, member_id)
        if not member.email:
            raise ServiceError(
                "Campaign member email is required before inviting app access",
                status_code=400,
                details={"campaign_id": campaign_id, "member_id": member_id, "field": "email"},
            )
        if payload.get("user_id") not in (None, ""):
            user = self._get_app_user(db, payload.get("user_id"))
            self._ensure_campaign_user_link_available(
                db,
                campaign_id,
                user.id,
                current_member_id=member.id,
            )
            member.app_user_id = user.id
        member.app_access_status = validate_invite_status(payload.get("app_access_status"))
        db.commit()
        return self.get_member(db, campaign_id, member_id)

    def remove_app_access(self, db: Session, campaign_id: str, member_id: str) -> CampaignMember:
        member = self.get_member(db, campaign_id, member_id)
        member.app_user_id = None
        member.app_access_status = APP_ACCESS_STATUS_NONE
        db.commit()
        return self.get_member(db, campaign_id, member_id)

    @staticmethod
    def _get_app_user(db: Session, user_id: object) -> AppUser:
        user = db.get(AppUser, require_app_user_id(user_id))
        if user is None:
            raise ServiceError("User not found", status_code=404, details={"user_id": str(user_id)})
        if not user.is_active:
            raise ServiceError("User is inactive", status_code=400, details={"user_id": str(user_id)})
        return user

    def _ensure_campaign_user_link_available(
        self,
        db: Session,
        campaign_id: str,
        user_id: uuid.UUID,
        *,
        current_member_id: uuid.UUID | None = None,
    ) -> None:
        query = db.query(CampaignMember).filter(
            CampaignMember.campaign_id == campaign_id,
            CampaignMember.app_user_id == user_id,
        )
        if current_member_id is not None:
            query = query.filter(CampaignMember.id != current_member_id)
        existing = query.one_or_none()
        if existing is not None:
            raise ServiceError(
                "Campaign member is already linked to this app user",
                status_code=409,
                details={"campaign_id": campaign_id, "user_id": str(user_id)},
            )

    @staticmethod
    def _get_access_role(
        db: Session,
        member_id: uuid.UUID,
        assignment_id: str,
    ) -> CampaignMemberAccessRole:
        assignment_uuid = require_access_role_assignment_id(assignment_id)
        assignment = (
            db.query(CampaignMemberAccessRole)
            .options(joinedload(CampaignMemberAccessRole.campaign_member))
            .filter(
                CampaignMemberAccessRole.campaign_member_id == member_id,
                CampaignMemberAccessRole.id == assignment_uuid,
            )
            .one_or_none()
        )
        if assignment is None:
            raise ServiceError(
                "Campaign member access role not found",
                status_code=404,
                details={"member_id": str(member_id), "assignment_id": assignment_id},
            )
        return assignment
