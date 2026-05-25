from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.account.validation import (
    parse_bool,
    validate_date_format,
    validate_default_landing_page,
    validate_display_name,
    validate_timezone,
)
from app.models.app_user import AppUser
from app.models.app_user_settings import AppUserSettings


class AccountService:
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
