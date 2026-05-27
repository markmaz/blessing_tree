from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import FRONTEND_BASE_URL, PASSWORD_RESET_URL
from app.exceptions.service_error import ServiceError
from app.features.admin.validation import require_email, validate_password
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
from app.models.auth_password_reset_token import AuthPasswordResetToken
from app.services.auth.password_service import PasswordService

PASSWORD_RESET_TTL_HOURS = 2


class PasswordResetService:
    def __init__(self, password_service: PasswordService | None = None) -> None:
        self.passwords = password_service or PasswordService()

    def request_reset(self, db: Session, email_value: object) -> None:
        email = require_email(email_value)
        identity = (
            db.query(AuthIdentity)
            .join(AppUser, AppUser.id == AuthIdentity.user_id)
            .filter(
                AuthIdentity.provider == "LOCAL",
                AuthIdentity.is_active == 1,
                AppUser.is_active == 1,
                func.lower(AuthIdentity.email) == email,
            )
            .one_or_none()
        )
        if identity is None or identity.user is None or not identity.password_hash:
            return

        now = self._now()
        db.query(AuthPasswordResetToken).filter(
            AuthPasswordResetToken.user_id == identity.user_id,
            AuthPasswordResetToken.used_at.is_(None),
            AuthPasswordResetToken.expires_at > now,
        ).update({AuthPasswordResetToken.used_at: now}, synchronize_session=False)

        raw_token = secrets.token_urlsafe(32)
        reset_token = AuthPasswordResetToken(
            id=uuid.uuid4(),
            user_id=identity.user_id,
            token_hash=self._hash_token(raw_token),
            expires_at=now + timedelta(hours=PASSWORD_RESET_TTL_HOURS),
        )
        db.add(reset_token)
        db.commit()

        reset_url = build_password_reset_url(raw_token)
        from app.tasks.admin_tasks import send_password_reset_email_task

        send_password_reset_email_task.delay(identity.email or identity.user.email, identity.user.display_name, reset_url)

    def validate_reset_token(self, db: Session, raw_token: str) -> dict[str, object]:
        token = self._get_usable_token(db, raw_token)
        return {
            "email": token.user.email if token.user else "",
            "expires_at": token.expires_at.isoformat(),
        }

    def reset_password(self, db: Session, payload: dict[str, object]) -> None:
        raw_token = str(payload.get("token") or "").strip()
        new_password = validate_password(payload.get("new_password"))
        confirm_password = str(payload.get("confirm_password") or "")
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

        reset_token = self._get_usable_token(db, raw_token)
        identity = (
            db.query(AuthIdentity)
            .filter(
                AuthIdentity.user_id == reset_token.user_id,
                AuthIdentity.provider == "LOCAL",
                AuthIdentity.is_active == 1,
            )
            .one_or_none()
        )
        if identity is None:
            raise ServiceError("Password reset link is invalid or expired", status_code=400)

        identity.password_hash = self.passwords.hash_password(new_password)
        reset_token.used_at = self._now()
        db.commit()

    def _get_usable_token(self, db: Session, raw_token: str) -> AuthPasswordResetToken:
        if not raw_token:
            raise ServiceError("Password reset link is invalid or expired", status_code=400)

        token_hash = self._hash_token(raw_token)
        token = (
            db.query(AuthPasswordResetToken)
            .filter(AuthPasswordResetToken.token_hash == token_hash)
            .one_or_none()
        )
        now = self._now()
        if token is None or token.used_at is not None or token.expires_at <= now:
            raise ServiceError("Password reset link is invalid or expired", status_code=400)
        if token.user is None or not token.user.is_active:
            raise ServiceError("Password reset link is invalid or expired", status_code=400)
        return token

    @staticmethod
    def _hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC).replace(tzinfo=None)


def build_password_reset_url(token: str) -> str:
    configured_url = str(PASSWORD_RESET_URL or "").strip()
    if configured_url:
        if "{token}" in configured_url:
            return configured_url.replace("{token}", token)
        separator = "&" if "?" in configured_url else "?"
        return f"{configured_url}{separator}{urlencode({'token': token})}"

    base = str(FRONTEND_BASE_URL or "http://localhost:5173").rstrip("/")
    return f"{base}/auth/reset-password?{urlencode({'token': token})}"
