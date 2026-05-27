from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.admin.validation import validate_password
from app.features.account.validation import (
    parse_bool,
    validate_date_format,
    validate_default_landing_page,
    validate_display_name,
    validate_timezone,
)
from app.models.app_user import AppUser
from app.models.app_user_settings import AppUserSettings
from app.models.auth import AuthIdentity
from app.services.auth.password_service import PasswordService


class AccountService:
    def __init__(self, password_service: PasswordService | None = None):
        self.passwords = password_service or PasswordService()

    def get_profile(self, db: Session, user_id: str) -> AppUser:
        return self._get_user(db, user_id)

    def update_profile(self, db: Session, user_id: str, payload: dict[str, object]) -> AppUser:
        user = self._get_user(db, user_id)
        if "display_name" in payload:
            user.display_name = validate_display_name(payload.get("display_name"))
        db.commit()
        db.refresh(user)
        return user

    def get_settings(self, db: Session, user_id: str) -> AppUserSettings:
        user = self._get_user(db, user_id)
        return self._ensure_settings(db, user)

    def update_settings(self, db: Session, user_id: str, payload: dict[str, object]) -> AppUserSettings:
        user = self._get_user(db, user_id)
        settings = self._ensure_settings(db, user)

        if "timezone" in payload:
            settings.timezone = validate_timezone(payload.get("timezone"))
        if "date_format" in payload:
            settings.date_format = validate_date_format(payload.get("date_format"))
        if "default_landing_page" in payload:
            settings.default_landing_page = validate_default_landing_page(payload.get("default_landing_page"))
        if "email_notifications_enabled" in payload:
            settings.email_notifications_enabled = parse_bool(
                payload.get("email_notifications_enabled"),
                "email_notifications_enabled",
            )

        db.commit()
        db.refresh(settings)
        return settings

    def change_password(self, db: Session, user_id: str, payload: dict[str, object]) -> None:
        user = self._get_user(db, user_id)
        current_password = str(payload.get("current_password") or "")
        new_password = validate_password(payload.get("new_password"))
        confirm_password = str(payload.get("confirm_password") or "")

        if not current_password:
            raise ServiceError(
                "Current password is required",
                status_code=400,
                details={"field": "current_password"},
            )
        if not confirm_password:
            raise ServiceError(
                "Password confirmation is required",
                status_code=400,
                details={"field": "confirm_password"},
            )
        if confirm_password != new_password:
            raise ServiceError(
                "Password confirmation does not match",
                status_code=400,
                details={"field": "confirm_password"},
            )

        identity = (
            db.query(AuthIdentity)
            .filter(
                AuthIdentity.user_id == user.id,
                AuthIdentity.provider == "LOCAL",
                AuthIdentity.is_active == 1,
            )
            .one_or_none()
        )
        if identity is None or not identity.password_hash:
            raise ServiceError(
                "Password changes are only available for local accounts",
                status_code=400,
                details={"field": "password"},
            )
        if not self.passwords.verify_password(current_password, identity.password_hash):
            raise ServiceError(
                "Current password is incorrect",
                status_code=400,
                details={"field": "current_password"},
            )

        identity.password_hash = self.passwords.hash_password(new_password)
        db.commit()

    def _get_user(self, db: Session, user_id: str) -> AppUser:
        try:
            parsed_user_id = uuid.UUID(str(user_id))
        except ValueError as exc:
            raise ServiceError("Invalid user identity", status_code=401) from exc

        user = (
            db.query(AppUser)
            .options(joinedload(AppUser.settings))
            .filter(AppUser.id == parsed_user_id)
            .one_or_none()
        )
        if user is None:
            raise ServiceError("User account not found", status_code=404)
        if not user.is_active:
            raise ServiceError("User account is inactive", status_code=403)
        return user

    @staticmethod
    def _ensure_settings(db: Session, user: AppUser) -> AppUserSettings:
        if user.settings is not None:
            return user.settings

        settings = AppUserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings
