from __future__ import annotations

import uuid
from collections import Counter
from collections.abc import Mapping

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_validation import parse_bool, require_user_id, validate_role_key
from app.features.rbac.constants import CAMPAIGN_MANAGER_ROLE
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.models.app_user import AppUser


class CampaignStudioTeamService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def list_assignments(self, db: Session, campaign_id: str) -> list[CampaignUserRole]:
        return (
            db.query(CampaignUserRole)
            .options(joinedload(CampaignUserRole.user))
            .filter(CampaignUserRole.campaign_id == campaign_id)
            .order_by(CampaignUserRole.role_key.asc(), CampaignUserRole.created_at.asc())
            .all()
        )

    def get_team_snapshot(self, db: Session, campaign_id: str) -> dict[str, object]:
        assignments = self.list_assignments(db, campaign_id)
        active_assignments = [assignment for assignment in assignments if assignment.is_active]
        role_counts = Counter(assignment.role_key for assignment in active_assignments)
        member_count = len({assignment.user_id for assignment in active_assignments})
        return {
            "assignments": assignments,
            "counts": {
                "assignment_count": len(assignments),
                "active_assignment_count": len(active_assignments),
                "member_count": member_count,
                "manager_count": role_counts.get(CAMPAIGN_MANAGER_ROLE, 0),
                "role_counts": dict(sorted(role_counts.items())),
            },
        }

    def create_assignment(
        self,
        db: Session,
        campaign_id: str,
        payload: Mapping[str, object],
    ) -> CampaignUserRole:
        user_id = require_user_id(payload.get("user_id"))
        role_key = validate_role_key(payload.get("role_key"))
        is_active = parse_bool(payload.get("is_active"), "is_active", default=True)
        self.campaigns.get_campaign(db, campaign_id)
        user = db.get(AppUser, user_id)
        if user is None:
            raise ServiceError("User not found", status_code=404, details={"user_id": str(user_id)})
        if not user.is_active:
            raise ServiceError("User is inactive", status_code=400, details={"user_id": str(user_id)})

        existing = (
            db.query(CampaignUserRole)
            .filter(
                CampaignUserRole.campaign_id == campaign_id,
                CampaignUserRole.user_id == user_id,
                CampaignUserRole.role_key == role_key,
            )
            .one_or_none()
        )
        if existing is not None:
            raise ServiceError(
                "Campaign role assignment already exists",
                status_code=409,
                details={"campaign_id": campaign_id, "user_id": str(user_id), "role_key": role_key},
            )

        assignment = CampaignUserRole(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            user_id=user_id,
            role_key=role_key,
            is_active=is_active,
        )
        db.add(assignment)
        db.commit()
        return self._get_assignment(db, campaign_id, str(assignment.id))

    def search_directory_users(
        self,
        db: Session,
        campaign_id: str,
        *,
        search: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, object]]:
        self.campaigns.get_campaign(db, campaign_id)
        normalized_search = str(search or "").strip()
        normalized_limit = min(max(int(limit or 10), 1), 25)

        query = db.query(AppUser).filter(AppUser.is_active == 1)
        if normalized_search:
            pattern = f"%{normalized_search.lower()}%"
            query = query.filter(
                or_(
                    func.lower(AppUser.display_name).like(pattern),
                    func.lower(AppUser.email).like(pattern),
                )
            )

        users = (
            query.order_by(AppUser.display_name.asc(), AppUser.email.asc())
            .limit(normalized_limit)
            .all()
        )
        if not users:
            return []

        role_rows = (
            db.query(CampaignUserRole.user_id, CampaignUserRole.role_key, CampaignUserRole.is_active)
            .filter(
                CampaignUserRole.campaign_id == campaign_id,
                CampaignUserRole.user_id.in_([user.id for user in users]),
            )
            .all()
        )

        role_map: dict[uuid.UUID, list[str]] = {}
        inactive_role_map: dict[uuid.UUID, list[str]] = {}
        for user_id, role_key, is_active in role_rows:
            bucket = role_map if is_active else inactive_role_map
            bucket.setdefault(user_id, []).append(role_key)

        return [
            {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "app_role": user.role,
                "is_active": bool(user.is_active),
                "assigned_role_keys": sorted(role_map.get(user.id, [])),
                "inactive_role_keys": sorted(inactive_role_map.get(user.id, [])),
            }
            for user in users
        ]

    def update_assignment(
        self,
        db: Session,
        campaign_id: str,
        assignment_id: str,
        payload: Mapping[str, object],
    ) -> CampaignUserRole:
        assignment = self._get_assignment(db, campaign_id, assignment_id)
        if "role_key" in payload:
            next_role_key = validate_role_key(payload.get("role_key"))
            duplicate = (
                db.query(CampaignUserRole)
                .filter(
                    CampaignUserRole.campaign_id == campaign_id,
                    CampaignUserRole.user_id == assignment.user_id,
                    CampaignUserRole.role_key == next_role_key,
                    CampaignUserRole.id != assignment.id,
                )
                .one_or_none()
            )
            if duplicate is not None:
                raise ServiceError(
                    "Campaign role assignment already exists",
                    status_code=409,
                    details={"campaign_id": campaign_id, "user_id": str(assignment.user_id), "role_key": next_role_key},
                )
            assignment.role_key = next_role_key
        if "is_active" in payload:
            assignment.is_active = parse_bool(payload.get("is_active"), "is_active")
        db.commit()
        return self._get_assignment(db, campaign_id, assignment_id)

    def _get_assignment(self, db: Session, campaign_id: str, assignment_id: str) -> CampaignUserRole:
        assignment = (
            db.query(CampaignUserRole)
            .options(joinedload(CampaignUserRole.user))
            .filter(CampaignUserRole.campaign_id == campaign_id, CampaignUserRole.id == assignment_id)
            .one_or_none()
        )
        if assignment is None:
            raise ServiceError(
                "Campaign assignment not found",
                status_code=404,
                details={"campaign_id": campaign_id, "assignment_id": assignment_id},
            )
        return assignment
