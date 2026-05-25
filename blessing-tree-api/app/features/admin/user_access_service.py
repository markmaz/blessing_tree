from __future__ import annotations

import uuid
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.rbac.constants import (
    CAMPAIGN_ROLE_CAPABILITIES,
    list_campaign_role_catalog,
    normalize_campaign_role_key,
)
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.features.rbac.services.authorization_service import AuthorizationService
from app.models.app_user import AppUser
from app.models.campaign import Campaign


class AdminUserAccessService:
    def __init__(self, authorization: AuthorizationService | None = None) -> None:
        self.authorization = authorization or AuthorizationService()

    def get_user_campaign_access(self, db: Session, user_id: str) -> dict[str, object]:
        user = _get_user(db, user_id)
        campaigns = db.query(Campaign).order_by(Campaign.year.desc(), Campaign.name.asc()).all()
        rows = []
        for campaign in campaigns:
            role_keys = sorted(self.authorization.get_campaign_role_keys(db, user.id, campaign.id))
            rows.append(
                {
                    "campaign": campaign,
                    "role_keys": role_keys,
                    "capabilities": sorted(self.authorization.get_campaign_capabilities(db, user.id, campaign.id)),
                }
            )
        return {
            "user_id": str(user.id),
            "campaigns": rows,
            "role_catalog": list_campaign_role_catalog(),
        }

    def replace_user_campaign_access(
        self,
        db: Session,
        user_id: str,
        payload: Mapping[str, object],
    ) -> dict[str, object]:
        user = _get_user(db, user_id)
        assignments = _validate_assignments(payload.get("assignments"))
        campaign_ids = {assignment["campaign_id"] for assignment in assignments}
        if campaign_ids:
            existing_campaign_ids = {
                campaign_id
                for (campaign_id,) in db.query(Campaign.id)
                .filter(Campaign.id.in_(campaign_ids))
                .all()
            }
            missing_campaign_ids = sorted(str(campaign_id) for campaign_id in campaign_ids - existing_campaign_ids)
            if missing_campaign_ids:
                raise ServiceError(
                    "One or more campaigns were not found",
                    status_code=400,
                    details={"campaign_ids": missing_campaign_ids},
                )

        db.query(CampaignUserRole).filter(CampaignUserRole.user_id == user.id).delete(synchronize_session=False)
        for assignment in assignments:
            for role_key in assignment["role_keys"]:
                db.add(
                    CampaignUserRole(
                        id=uuid.uuid4(),
                        campaign_id=assignment["campaign_id"],
                        user_id=user.id,
                        role_key=role_key,
                        is_active=True,
                    )
                )
        db.commit()
        return self.get_user_campaign_access(db, str(user.id))


def _get_user(db: Session, user_id: str) -> AppUser:
    try:
        user_uuid = uuid.UUID(str(user_id))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ServiceError("user_id must be a valid UUID", status_code=400, details={"field": "user_id"}) from exc
    user = db.get(AppUser, user_uuid)
    if user is None:
        raise ServiceError("User not found", status_code=404, details={"user_id": user_id})
    return user


def _validate_assignments(value: object) -> list[dict[str, object]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ServiceError("assignments must be a list", status_code=400, details={"field": "assignments"})
    normalized_assignments = []
    seen_campaigns: set[uuid.UUID] = set()
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ServiceError("assignment must be an object", status_code=400, details={"index": index})
        try:
            campaign_id = uuid.UUID(str(item.get("campaign_id")))
        except (TypeError, ValueError, AttributeError) as exc:
            raise ServiceError(
                "campaign_id must be a valid UUID",
                status_code=400,
                details={"field": "campaign_id", "index": index},
            ) from exc
        if campaign_id in seen_campaigns:
            raise ServiceError(
                "campaign_id can appear only once",
                status_code=400,
                details={"field": "campaign_id", "index": index},
            )
        seen_campaigns.add(campaign_id)
        role_keys = _validate_role_keys(item.get("role_keys"), index=index)
        if role_keys:
            normalized_assignments.append({"campaign_id": campaign_id, "role_keys": role_keys})
    return normalized_assignments


def _validate_role_keys(value: object, *, index: int) -> list[str]:
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise ServiceError("role_keys must be a list", status_code=400, details={"field": "role_keys", "index": index})
    normalized = []
    for role_key in value:
        normalized_role_key = normalize_campaign_role_key(str(role_key))
        if normalized_role_key not in CAMPAIGN_ROLE_CAPABILITIES:
            raise ServiceError(
                "role_key is invalid",
                status_code=400,
                details={"field": "role_keys", "role_key": role_key, "index": index},
            )
        if normalized_role_key not in normalized:
            normalized.append(normalized_role_key)
    return normalized
