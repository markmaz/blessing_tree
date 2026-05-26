from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.config import INVITE_URL
from app.exceptions.service_error import ServiceError
from app.features.admin.constants import DEFAULT_INVITE_TTL_HOURS, GLOBAL_APP_ROLE_CATALOG
from app.features.admin.invitation_tokens import issue_invitation_token, read_invitation_token
from app.features.admin.validation import require_email, require_text, validate_global_role, validate_password
from app.models.admin_user_invitation import AdminUserInvitation
from app.models.app_user import AppUser
from app.models.app_user_settings import AppUserSettings
from app.models.auth import AuthIdentity
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_constants import APP_ACCESS_STATUS_NONE
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.services.auth import AuthError, AuthService


class AdminInvitationService:
    def __init__(self, auth_service: AuthService | None = None) -> None:
        self._auth_service = auth_service or AuthService()

    def list_users(self, db: Session) -> list[AppUser]:
        return (
            db.query(AppUser)
            .options(joinedload(AppUser.auth_identities))
            .order_by(AppUser.display_name.asc(), AppUser.email.asc())
            .all()
        )

    def list_invitations(self, db: Session) -> list[AdminUserInvitation]:
        return (
            db.query(AdminUserInvitation)
            .options(joinedload(AdminUserInvitation.user))
            .order_by(AdminUserInvitation.created_at.desc())
            .all()
        )

    def create_invitation(self, db: Session, payload: dict[str, object], *, invited_by_user_id: str | None) -> tuple[AppUser, AdminUserInvitation, str]:
        email = require_email(payload.get("email"))
        display_name = require_text(payload.get("display_name"), "display_name")
        role = validate_global_role(payload.get("role") or "COORDINATOR")

        existing_user = (
            db.query(AppUser)
            .options(joinedload(AppUser.auth_identities))
            .filter(func.lower(AppUser.email) == email)
            .one_or_none()
        )
        if existing_user is not None:
            raise ServiceError(
                "A user with this email already exists",
                status_code=409,
                details={"email": email},
            )

        user = AppUser(
            id=uuid.uuid4(),
            email=email,
            display_name=display_name,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()

        invitation = self._new_invitation(user_id=user.id, email=email, invited_by_user_id=invited_by_user_id)
        db.add(invitation)
        db.commit()
        db.refresh(user)
        db.refresh(invitation)

        invite_url = self._invite_url(invitation)
        from app.tasks.admin_tasks import send_admin_invite_email_task

        send_admin_invite_email_task.delay(email, display_name, invite_url)
        return user, invitation, invite_url

    def resend_invitation(self, db: Session, invitation_id: str, *, invited_by_user_id: str | None) -> tuple[AdminUserInvitation, str]:
        invitation = self._get_invitation(db, invitation_id)
        if invitation.accepted_at:
            raise ServiceError("Invitation has already been accepted", status_code=409)

        invitation.revoked_at = datetime.now(UTC).replace(tzinfo=None)
        replacement = self._new_invitation(
            user_id=invitation.user_id,
            email=invitation.email,
            invited_by_user_id=invited_by_user_id,
        )
        db.add(replacement)
        db.commit()
        db.refresh(replacement)

        invite_url = self._invite_url(replacement)
        user_name = invitation.user.display_name if invitation.user else invitation.email
        from app.tasks.admin_tasks import send_admin_invite_email_task

        send_admin_invite_email_task.delay(replacement.email, user_name, invite_url)
        return replacement, invite_url

    def validate_invitation_token(self, db: Session, token: str) -> dict[str, object]:
        invitation = self._resolve_token_for_validation(db, token)
        user = invitation.user
        if user is None:
            raise ServiceError("Invitation is invalid", status_code=400)
        has_local_identity = any(identity.provider == "LOCAL" for identity in user.auth_identities)
        return {
            "invitation_id": str(invitation.id),
            "user_id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "expires_at": invitation.expires_at.isoformat(),
            "status": "accepted" if invitation.accepted_at else "pending",
            "accepted_at": invitation.accepted_at.isoformat() if invitation.accepted_at else None,
            "onboarding_complete": invitation.accepted_at is not None,
            "has_local_identity": has_local_identity,
        }

    def accept_invitation(self, db: Session, token: str, payload: dict[str, object]) -> AppUser:
        invitation = self._resolve_token(db, token)
        user = invitation.user
        if user is None:
            raise ServiceError("Invitation is invalid", status_code=400)

        email = require_email(payload.get("email") or user.email)
        if email.lower() != user.email.lower():
            raise ServiceError("Email does not match invited account", status_code=403)

        display_name = require_text(payload.get("display_name") or user.display_name, "display_name")
        password = validate_password(payload.get("password"))

        existing_local_identity = (
            db.query(AuthIdentity)
            .filter(AuthIdentity.user_id == user.id, AuthIdentity.provider == "LOCAL")
            .one_or_none()
        )
        if existing_local_identity is not None:
            raise ServiceError(
                "This invitation has already been accepted. Sign in with your existing account.",
                status_code=409,
            )

        try:
            self._auth_service.create_local_identity(db, user.id, user.email, password)
        except AuthError as exc:
            raise ServiceError(str(exc), status_code=exc.status_code)

        user.display_name = display_name
        invitation.accepted_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        db.refresh(user)
        return user

    def update_user_status(
        self,
        db: Session,
        user_id: str,
        *,
        is_active: bool,
    ) -> AppUser:
        user = db.query(AppUser).filter(AppUser.id == user_id).one_or_none()
        if user is None:
            raise ServiceError("User not found", status_code=404, details={"user_id": user_id})

        user.is_active = bool(is_active)
        db.commit()
        db.refresh(user)
        return user

    def update_user_role(self, db: Session, user_id: str, role: object) -> AppUser:
        user = db.query(AppUser).filter(AppUser.id == user_id).one_or_none()
        if user is None:
            raise ServiceError("User not found", status_code=404, details={"user_id": user_id})

        user.role = validate_global_role(role)
        db.commit()
        db.refresh(user)
        return user

    def delete_user(self, db: Session, user_id: str, *, requested_by_user_id: str | None) -> None:
        user_uuid = self._parse_user_id(user_id)
        if requested_by_user_id:
            requested_by_uuid = self._parse_user_id(requested_by_user_id)
            if requested_by_uuid == user_uuid:
                raise ServiceError(
                    "You cannot delete your own user account",
                    status_code=409,
                    details={"user_id": user_id},
                )

        user = db.get(AppUser, user_uuid)
        if user is None:
            raise ServiceError("User not found", status_code=404, details={"user_id": user_id})
        if user.is_active:
            raise ServiceError(
                "Only deactivated users can be deleted",
                status_code=409,
                details={"user_id": user_id},
            )

        db.query(CampaignMember).filter(CampaignMember.app_user_id == user.id).update(
            {
                CampaignMember.app_user_id: None,
                CampaignMember.app_access_status: APP_ACCESS_STATUS_NONE,
            },
            synchronize_session=False,
        )
        db.query(AdminUserInvitation).filter(AdminUserInvitation.invited_by_user_id == user.id).update(
            {AdminUserInvitation.invited_by_user_id: None},
            synchronize_session=False,
        )
        db.query(AdminUserInvitation).filter(AdminUserInvitation.user_id == user.id).delete(synchronize_session=False)
        db.query(CampaignUserRole).filter(CampaignUserRole.user_id == user.id).delete(synchronize_session=False)
        db.query(AuthIdentity).filter(AuthIdentity.user_id == user.id).delete(synchronize_session=False)
        db.query(AppUserSettings).filter(AppUserSettings.user_id == user.id).delete(synchronize_session=False)
        db.delete(user)
        db.commit()

    @staticmethod
    def list_global_role_catalog() -> list[dict[str, str]]:
        return [dict(item) for item in GLOBAL_APP_ROLE_CATALOG]

    def _resolve_token(self, db: Session, token: str) -> AdminUserInvitation:
        payload = read_invitation_token(token, max_age_seconds=DEFAULT_INVITE_TTL_HOURS * 60 * 60)
        invitation = self._lookup_invitation(db, payload["invitation_id"])
        self._assert_invitation_is_actionable(invitation)
        return invitation

    def _resolve_token_for_validation(self, db: Session, token: str) -> AdminUserInvitation:
        payload = read_invitation_token(token, max_age_seconds=DEFAULT_INVITE_TTL_HOURS * 60 * 60)
        invitation = self._lookup_invitation(db, payload["invitation_id"])
        now = datetime.now(UTC).replace(tzinfo=None)
        if invitation.revoked_at:
            raise ServiceError(
                "This invitation has been revoked. Ask an administrator for a new invitation.",
                status_code=410,
            )
        if invitation.expires_at <= now:
            raise ServiceError(
                "This invitation has expired. Ask an administrator for a new invitation.",
                status_code=410,
            )
        return invitation

    @staticmethod
    def _assert_invitation_is_actionable(invitation: AdminUserInvitation) -> None:
        now = datetime.now(UTC).replace(tzinfo=None)
        if invitation.revoked_at:
            raise ServiceError(
                "This invitation has been revoked. Ask an administrator for a new invitation.",
                status_code=410,
            )
        if invitation.accepted_at:
            raise ServiceError(
                "This invitation has already been accepted. Sign in with your existing account.",
                status_code=409,
            )
        if invitation.expires_at <= now:
            raise ServiceError(
                "This invitation has expired. Ask an administrator for a new invitation.",
                status_code=410,
            )

    @staticmethod
    def _lookup_invitation(db: Session, invitation_id: str) -> AdminUserInvitation:
        invitation = (
            db.query(AdminUserInvitation)
            .options(joinedload(AdminUserInvitation.user))
            .filter(AdminUserInvitation.id == invitation_id)
            .one_or_none()
        )
        if invitation is None:
            raise ServiceError("Invalid or expired invitation token", status_code=400)
        return invitation

    @staticmethod
    def _get_invitation(db: Session, invitation_id: str) -> AdminUserInvitation:
        invitation = (
            db.query(AdminUserInvitation)
            .options(joinedload(AdminUserInvitation.user))
            .filter(AdminUserInvitation.id == invitation_id)
            .one_or_none()
        )
        if invitation is None:
            raise ServiceError("Invitation not found", status_code=404, details={"invitation_id": invitation_id})
        return invitation

    @staticmethod
    def _new_invitation(*, user_id: uuid.UUID, email: str, invited_by_user_id: str | None) -> AdminUserInvitation:
        now = datetime.now(UTC).replace(tzinfo=None)
        return AdminUserInvitation(
            id=uuid.uuid4(),
            user_id=user_id,
            email=email,
            invited_by_user_id=uuid.UUID(invited_by_user_id) if invited_by_user_id else None,
            expires_at=now + timedelta(hours=DEFAULT_INVITE_TTL_HOURS),
        )

    def _invite_url(self, invitation: AdminUserInvitation) -> str:
        token = issue_invitation_token(str(invitation.id), str(invitation.user_id), invitation.email)
        base = str(INVITE_URL or "http://localhost:5173/auth/register").rstrip("/")
        separator = "&" if "?" in base else "?"
        return f"{base}{separator}token={token}"

    @staticmethod
    def _parse_user_id(user_id: str) -> uuid.UUID:
        try:
            return uuid.UUID(str(user_id))
        except (TypeError, ValueError, AttributeError) as exc:
            raise ServiceError("user_id must be a valid UUID", status_code=400, details={"field": "user_id"}) from exc
