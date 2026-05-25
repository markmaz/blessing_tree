from __future__ import annotations

from app.models.app_user import AppUser
from app.models.app_user_settings import AppUserSettings


def serialize_account_profile(user: AppUser) -> dict[str, object]:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "is_active": bool(user.is_active),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
    }


def serialize_account_settings(settings: AppUserSettings) -> dict[str, object]:
    return {
        "timezone": settings.timezone,
        "date_format": settings.date_format,
        "default_landing_page": settings.default_landing_page,
        "email_notifications_enabled": bool(settings.email_notifications_enabled),
        "created_at": settings.created_at.isoformat(),
        "updated_at": settings.updated_at.isoformat(),
    }
