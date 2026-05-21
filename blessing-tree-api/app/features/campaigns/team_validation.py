from __future__ import annotations

import uuid

from app.exceptions.service_error import ServiceError
from app.features.campaigns.studio_validation import parse_bool, require_short_text, validate_role_key
from app.models.campaign_member_constants import (
    APP_ACCESS_STATUS_ACTIVE,
    APP_ACCESS_STATUS_INVITED,
    APP_ACCESS_STATUS_LINKED,
    APP_ACCESS_STATUS_NONE,
    CAMPAIGN_MEMBER_APP_ACCESS_STATUSES,
    CAMPAIGN_MEMBER_TYPES,
)


def require_member_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        raise ServiceError("Valid member_id is required", status_code=400, details={"field": "member_id"})


def require_team_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        raise ServiceError("Valid team_id is required", status_code=400, details={"field": "team_id"})


def require_access_role_assignment_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        raise ServiceError(
            "Valid assignment_id is required",
            status_code=400,
            details={"field": "assignment_id"},
        )


def require_team_role_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        raise ServiceError(
            "Valid team_role_id is required",
            status_code=400,
            details={"field": "team_role_id"},
        )


def require_app_user_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        raise ServiceError("Valid user_id is required", status_code=400, details={"field": "user_id"})


def validate_member_type(value: object) -> str:
    member_type = str(value or "").strip().lower()
    if member_type not in CAMPAIGN_MEMBER_TYPES:
        raise ServiceError(
            "Campaign member_type is invalid",
            status_code=400,
            details={"field": "member_type", "allowed_values": sorted(CAMPAIGN_MEMBER_TYPES)},
        )
    return member_type


def validate_app_access_status(value: object) -> str:
    app_access_status = str(value or "").strip().lower()
    if app_access_status not in CAMPAIGN_MEMBER_APP_ACCESS_STATUSES:
        raise ServiceError(
            "Campaign member app_access_status is invalid",
            status_code=400,
            details={
                "field": "app_access_status",
                "allowed_values": sorted(CAMPAIGN_MEMBER_APP_ACCESS_STATUSES),
            },
        )
    return app_access_status


def validate_optional_email(value: object) -> str | None:
    if value in (None, ""):
        return None
    email = str(value).strip().lower()
    if not email or "@" not in email:
        raise ServiceError("Email is invalid", status_code=400, details={"field": "email"})
    if len(email) > 255:
        raise ServiceError(
            "Email exceeds max length",
            status_code=400,
            details={"field": "email", "max_length": 255},
        )
    return email


def validate_optional_phone(value: object) -> str | None:
    if value in (None, ""):
        return None
    return require_short_text(value, "phone", max_length=64)


def validate_optional_notes(value: object) -> str | None:
    if value in (None, ""):
        return None
    return require_short_text(value, "notes", max_length=5000)


def validate_link_status(value: object) -> str:
    if value in (None, ""):
        return APP_ACCESS_STATUS_LINKED
    status = validate_app_access_status(value)
    if status not in {APP_ACCESS_STATUS_LINKED, APP_ACCESS_STATUS_ACTIVE}:
        raise ServiceError(
            "Linked app access status is invalid",
            status_code=400,
            details={
                "field": "app_access_status",
                "allowed_values": [APP_ACCESS_STATUS_LINKED, APP_ACCESS_STATUS_ACTIVE],
            },
        )
    return status


def validate_invite_status(value: object) -> str:
    if value in (None, ""):
        return APP_ACCESS_STATUS_INVITED
    status = validate_app_access_status(value)
    if status not in {APP_ACCESS_STATUS_INVITED, APP_ACCESS_STATUS_LINKED}:
        raise ServiceError(
            "Invite app access status is invalid",
            status_code=400,
            details={
                "field": "app_access_status",
                "allowed_values": [APP_ACCESS_STATUS_INVITED, APP_ACCESS_STATUS_LINKED],
            },
        )
    return status


__all__ = [
    "parse_bool",
    "require_access_role_assignment_id",
    "require_app_user_id",
    "require_member_id",
    "require_team_id",
    "require_team_role_id",
    "require_short_text",
    "validate_app_access_status",
    "validate_invite_status",
    "validate_link_status",
    "validate_member_type",
    "validate_optional_email",
    "validate_optional_notes",
    "validate_optional_phone",
    "validate_role_key",
    "APP_ACCESS_STATUS_NONE",
]
