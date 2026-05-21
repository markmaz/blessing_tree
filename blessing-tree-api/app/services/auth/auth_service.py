from __future__ import annotations

import time
import uuid
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import ACCESS_TOKEN_TTL_MINUTES, REFRESH_TOKEN_TTL_DAYS
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
from app.services.auth.exceptions import AuthError, InactiveAccount, InvalidCredentials, NotApproved, OAuthError
from app.services.auth.jwt_service import JwtService
from app.services.auth.password_service import PasswordService
from app.services.auth.refresh_token_service import RefreshTokenService


class AuthService:
    def __init__(
        self,
        password_service: PasswordService | None = None,
        jwt_service: JwtService | None = None,
        refresh_token_service: RefreshTokenService | None = None,
    ) -> None:
        self.passwords = password_service or PasswordService()
        self.jwt = jwt_service or JwtService()
        self.refresh_tokens = refresh_token_service or RefreshTokenService()
        self.access_ttl_minutes = ACCESS_TOKEN_TTL_MINUTES
        self.refresh_ttl_seconds = int(REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60)

    def login_with_oauth(self, db: Session, provider: str, userinfo, ip: str | None, user_agent: str | None) -> tuple[dict, str]:
        provider_key = (provider or "").strip().upper()
        if not provider_key:
            raise OAuthError("Missing provider")

        sub = self._get_userinfo_field(userinfo, "sub")
        if not sub:
            raise OAuthError("User info missing subject")

        identity = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.provider == provider_key, AuthIdentity.provider_sub == sub)
            .one_or_none()
        )

        if identity is not None:
            if not identity.is_active:
                raise InactiveAccount()
            user = identity.user
            if user is None or not user.is_active:
                raise InactiveAccount()

            identity.email = self._normalize_email(self._get_userinfo_field(userinfo, "email"))
            user.last_login_at = datetime.utcnow()
            db.commit()
            return self._issue_tokens(user, provider_key, ip, user_agent)

        email = self._normalize_email(self._get_userinfo_field(userinfo, "email"))
        if not email:
            raise NotApproved(
                "Use your invitation link to finish setup",
                details={"email": None, "provider": provider_key},
            )

        raise NotApproved(
            "Use your invitation link to finish setup",
            details={"email": email, "provider": provider_key},
        )

    def bind_oauth_identity(self, db: Session, user: AppUser, provider: str, userinfo) -> AuthIdentity:
        provider_key = (provider or "").strip().upper()
        if not provider_key:
            raise OAuthError("Missing provider")

        sub = self._get_userinfo_field(userinfo, "sub")
        if not sub:
            raise OAuthError("User info missing subject")

        email = self._normalize_email(self._get_userinfo_field(userinfo, "email"))

        existing_by_sub = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.provider == provider_key, AuthIdentity.provider_sub == sub)
            .one_or_none()
        )
        if existing_by_sub is not None:
            if existing_by_sub.user_id != user.id:
                raise OAuthError("OAuth identity already linked to another user")
            existing_by_sub.email = email
            return existing_by_sub

        existing_by_user = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.user_id == user.id, AuthIdentity.provider == provider_key)
            .one_or_none()
        )
        if existing_by_user is not None:
            existing_by_user.provider_sub = sub
            existing_by_user.email = email
            existing_by_user.is_active = True
            return existing_by_user

        identity = AuthIdentity(
            id=uuid.uuid4(),
            user_id=user.id,
            provider=provider_key,
            provider_sub=sub,
            email=email,
            password_hash=None,
            is_active=True,
        )
        db.add(identity)
        return identity

    def issue_user_session(
        self,
        user: AppUser,
        provider: str,
        ip: str | None,
        user_agent: str | None,
    ) -> tuple[dict, str]:
        return self._issue_tokens(user, provider, ip, user_agent)

    def login_local(self, db: Session, email: str, password: str, ip: str | None, user_agent: str | None) -> tuple[dict, str]:
        email_norm = self._normalize_email(email)
        if not email_norm:
            raise InvalidCredentials()

        identity = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.provider == "LOCAL", func.lower(AuthIdentity.email) == email_norm)
            .one_or_none()
        )
        if identity is None or not identity.password_hash:
            raise InvalidCredentials()
        if not identity.is_active:
            raise InactiveAccount()

        user = identity.user
        if user is None or not user.is_active:
            raise InactiveAccount()

        if not self.passwords.verify_password(password, identity.password_hash):
            raise InvalidCredentials()

        user.last_login_at = datetime.utcnow()
        db.commit()

        return self._issue_tokens(user, "LOCAL", ip, user_agent)

    def refresh(self, db: Session, raw_refresh_token: str, ip: str | None, user_agent: str | None) -> tuple[dict, str]:
        if not raw_refresh_token:
            raise AuthError("Missing refresh token", status_code=401)

        old_hash = self.refresh_tokens.hash_refresh_token(raw_refresh_token)
        session = self.refresh_tokens.get_session(old_hash)
        if not session:
            raise AuthError("Invalid refresh token", status_code=401)

        expires_at = int(session.get("expires_at") or 0)
        if expires_at and expires_at <= int(time.time()):
            user_id = session.get("user_id")
            if user_id:
                self.refresh_tokens.remove_user_session(str(user_id), old_hash)
            self.refresh_tokens.delete_session(old_hash)
            raise AuthError("Refresh token expired", status_code=401)

        user_id = str(session.get("user_id") or "")
        if not user_id:
            raise AuthError("Invalid refresh token", status_code=401)

        user = db.query(AppUser).filter(AppUser.id == user_id).one_or_none()
        if user is None or not user.is_active:
            raise InactiveAccount()

        new_raw = self.refresh_tokens.generate_refresh_token_raw()
        new_payload = self.refresh_tokens.build_session_payload(
            user_id=user_id,
            provider=session.get("provider"),
            ip=ip,
            user_agent=user_agent,
            ttl_seconds=self.refresh_ttl_seconds,
            rotated_from=old_hash,
        )

        try:
            self.refresh_tokens.rotate_refresh_token(
                old_raw=raw_refresh_token,
                new_raw=new_raw,
                user_id=user_id,
                ttl_seconds=self.refresh_ttl_seconds,
                payload=new_payload,
            )
        except RuntimeError:
            raise AuthError("Refresh token already used", status_code=401)

        access_payload = self.jwt.issue_access_token(
            user_id=str(user.id),
            email=user.email,
            name=user.display_name,
            role=user.role,
            ttl_minutes=self.access_ttl_minutes,
        )
        return access_payload, new_raw

    def logout(self, db: Session, raw_refresh_token: str) -> None:
        if not raw_refresh_token:
            return
        self.refresh_tokens.revoke_refresh_token(raw_refresh_token)

    def create_local_identity(
        self,
        db: Session,
        user_id: uuid.UUID | str | None,
        email: str | None,
        password: str,
    ) -> AuthIdentity:
        if not password:
            raise AuthError("Password is required", status_code=400)

        user = None
        if user_id:
            user = db.query(AppUser).filter(AppUser.id == user_id).one_or_none()
        if user is None and email:
            email_norm = self._normalize_email(email)
            user = self._find_user_by_email(db, email_norm) if email_norm else None

        if user is None:
            raise AuthError("User not found", status_code=404)

        email_norm = self._normalize_email(email or user.email)
        if not email_norm:
            raise AuthError("Email is required", status_code=400)

        existing = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.provider == "LOCAL", func.lower(AuthIdentity.email) == email_norm)
            .one_or_none()
        )
        if existing:
            raise AuthError("Local identity already exists", status_code=409)

        identity = AuthIdentity(
            id=uuid.uuid4(),
            user_id=user.id,
            provider="LOCAL",
            provider_sub=None,
            email=email_norm,
            password_hash=self.passwords.hash_password(password),
            is_active=True,
        )
        db.add(identity)
        db.commit()
        db.refresh(identity)
        return identity

    def verify_token(self, token: str) -> dict | None:
        try:
            return self.jwt.decode_access_token(token)
        except Exception:
            return None

    def _issue_tokens(self, user: AppUser, provider: str, ip: str | None, user_agent: str | None) -> tuple[dict, str]:
        access_payload = self.jwt.issue_access_token(
            user_id=str(user.id),
            email=user.email,
            name=user.display_name,
            role=user.role,
            ttl_minutes=self.access_ttl_minutes,
        )

        raw_refresh = self.refresh_tokens.generate_refresh_token_raw()
        hash_hex = self.refresh_tokens.hash_refresh_token(raw_refresh)
        payload = self.refresh_tokens.build_session_payload(
            user_id=str(user.id),
            provider=provider,
            ip=ip,
            user_agent=user_agent,
            ttl_seconds=self.refresh_ttl_seconds,
        )
        self.refresh_tokens.store_session(hash_hex, payload, self.refresh_ttl_seconds)
        self.refresh_tokens.add_user_session(str(user.id), hash_hex, self.refresh_ttl_seconds)

        return access_payload, raw_refresh

    @staticmethod
    def _normalize_email(email: str | None) -> str | None:
        if not email:
            return None
        value = email.strip().lower()
        return value or None

    @staticmethod
    def _get_userinfo_field(userinfo, field: str) -> str | None:
        if userinfo is None:
            return None
        if hasattr(userinfo, field):
            return getattr(userinfo, field)
        if isinstance(userinfo, dict):
            return userinfo.get(field)
        return None

    @staticmethod
    def _find_user_by_email(db: Session, email_norm: str) -> AppUser | None:
        return db.query(AppUser).filter(func.lower(AppUser.email) == email_norm).one_or_none()
