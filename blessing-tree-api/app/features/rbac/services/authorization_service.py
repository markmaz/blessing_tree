from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.features.rbac.constants import (
    ALL_CAMPAIGN_CAPABILITIES,
    APP_ADMIN_ROLE,
    get_capabilities_for_campaign_role,
    normalize_app_role,
    normalize_campaign_role_key,
)
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.models.app_user import AppUser


class AuthorizationService:
    def get_global_app_role(self, user: AppUser | None) -> str:
        return normalize_app_role(user.role if user is not None else None)

    def is_app_admin(self, user: AppUser | None) -> bool:
        return bool(user and user.is_active and self.get_global_app_role(user) == APP_ADMIN_ROLE)

    def get_campaign_role_keys(
        self,
        db: Session,
        user_id: uuid.UUID | str | None,
        campaign_id: uuid.UUID | str | None,
    ) -> set[str]:
        user_uuid = self._coerce_uuid(user_id)
        campaign_uuid = self._coerce_uuid(campaign_id)
        if user_uuid is None or campaign_uuid is None:
            return set()

        rows = (
            db.query(CampaignUserRole.role_key)
            .filter(
                CampaignUserRole.user_id == user_uuid,
                CampaignUserRole.campaign_id == campaign_uuid,
                CampaignUserRole.is_active == 1,
            )
            .all()
        )
        return {normalize_campaign_role_key(role_key) for (role_key,) in rows if normalize_campaign_role_key(role_key)}

    def get_campaign_capabilities(
        self,
        db: Session,
        user_id: uuid.UUID | str | None,
        campaign_id: uuid.UUID | str | None,
    ) -> set[str]:
        user = self._get_user(db, user_id)
        if user is None or not user.is_active:
            return set()
        if self.is_app_admin(user):
            return set(ALL_CAMPAIGN_CAPABILITIES)

        capabilities: set[str] = set()
        for role_key in self.get_campaign_role_keys(db, user.id, campaign_id):
            capabilities.update(get_capabilities_for_campaign_role(role_key))
        return capabilities

    def user_has_campaign_capability(
        self,
        db: Session,
        user_id: uuid.UUID | str | None,
        campaign_id: uuid.UUID | str | None,
        capability: str,
    ) -> bool:
        normalized_capability = (capability or "").strip()
        if not normalized_capability:
            return False
        return normalized_capability in self.get_campaign_capabilities(db, user_id, campaign_id)

    def _get_user(self, db: Session, user_id: uuid.UUID | str | None) -> AppUser | None:
        user_uuid = self._coerce_uuid(user_id)
        if user_uuid is None:
            return None
        return db.get(AppUser, user_uuid)

    @staticmethod
    def _coerce_uuid(value: uuid.UUID | str | None) -> uuid.UUID | None:
        if value is None or value == "":
            return None
        if isinstance(value, uuid.UUID):
            return value
        try:
            return uuid.UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return None
