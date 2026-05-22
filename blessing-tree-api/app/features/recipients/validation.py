from __future__ import annotations

import uuid
from datetime import datetime

from app.exceptions.service_error import ServiceError
from app.models.recipient_constants import (
    RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
    GROUP_CONTACT_ROLE_COORDINATOR,
    GROUP_CONTACT_ROLE_GUARDIAN,
    GROUP_CONTACT_ROLE_OTHER,
    GROUP_CONTACT_ROLE_PARENT,
    GROUP_CONTACT_ROLE_SOCIAL_WORKER,
    GROUP_CONTACT_ROLE_STAFF,
    PREFERRED_CONTACT_EMAIL,
    PREFERRED_CONTACT_NONE,
    PREFERRED_CONTACT_PHONE,
    PREFERRED_CONTACT_TEXT,
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_STATUS_ARCHIVED,
    RECIPIENT_GROUP_STATUS_INACTIVE,
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_ADULT,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PRIVACY_LEVEL_INITIALS,
    RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
    RECIPIENT_STATUS_INACTIVE,
    WISHLIST_INTAKE_METHOD_FORM,
    WISHLIST_INTAKE_METHOD_IMPORT,
    WISHLIST_INTAKE_METHOD_OTHER,
    WISHLIST_INTAKE_METHOD_PHONE,
    WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
    WISHLIST_ITEM_TYPE_CLOTHING,
    WISHLIST_ITEM_TYPE_ESSENTIAL,
    WISHLIST_ITEM_TYPE_EXPERIENCE,
    WISHLIST_ITEM_TYPE_GIFT,
    WISHLIST_ITEM_TYPE_GIFT_CARD,
    WISHLIST_ITEM_TYPE_OTHER,
    WISHLIST_STATUS_DRAFT,
    WISHLIST_STATUS_LOCKED,
    WISHLIST_STATUS_READY,
)

GROUP_TYPES = {
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
}
GROUP_TYPE_ALIASES = {
    "CARE_FACILITY": RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
    "PARTNER_PROGRAM": RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
}
GROUP_STATUSES = {
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_STATUS_INACTIVE,
    RECIPIENT_GROUP_STATUS_ARCHIVED,
}
CONTACT_ROLES = {
    GROUP_CONTACT_ROLE_PARENT,
    GROUP_CONTACT_ROLE_GUARDIAN,
    GROUP_CONTACT_ROLE_SOCIAL_WORKER,
    GROUP_CONTACT_ROLE_STAFF,
    GROUP_CONTACT_ROLE_COORDINATOR,
    GROUP_CONTACT_ROLE_OTHER,
}
PREFERRED_CONTACTS = {
    PREFERRED_CONTACT_EMAIL,
    PREFERRED_CONTACT_PHONE,
    PREFERRED_CONTACT_TEXT,
    PREFERRED_CONTACT_NONE,
}
RECIPIENT_KINDS = {
    RECIPIENT_KIND_CHILD,
    RECIPIENT_KIND_ADULT,
}
PROGRAM_TYPES = {
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM,
}
PROGRAM_TYPE_ALIASES = {
    "NURSING_HOME": RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM,
    "SENIOR_FACILITY": RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM,
    "SENIOR_PARTNER_PROGRAM": RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM,
}
RECIPIENT_PRIVACY_LEVELS = {
    RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
    RECIPIENT_PRIVACY_LEVEL_INITIALS,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
}
RECIPIENT_STATUSES = {
    RECIPIENT_STATUS_ACTIVE,
    RECIPIENT_STATUS_INACTIVE,
}
WISHLIST_STATUSES = {
    WISHLIST_STATUS_DRAFT,
    WISHLIST_STATUS_READY,
    WISHLIST_STATUS_LOCKED,
}
WISHLIST_INTAKE_METHODS = {
    WISHLIST_INTAKE_METHOD_PHONE,
    WISHLIST_INTAKE_METHOD_FORM,
    WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
    WISHLIST_INTAKE_METHOD_IMPORT,
    WISHLIST_INTAKE_METHOD_OTHER,
}
WISHLIST_ITEM_TYPES = {
    WISHLIST_ITEM_TYPE_GIFT,
    WISHLIST_ITEM_TYPE_CLOTHING,
    WISHLIST_ITEM_TYPE_ESSENTIAL,
    WISHLIST_ITEM_TYPE_GIFT_CARD,
    WISHLIST_ITEM_TYPE_EXPERIENCE,
    WISHLIST_ITEM_TYPE_OTHER,
}


def require_uuid(value: object, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        raise ServiceError(
            f"Invalid {field_name}",
            status_code=400,
            details={"field": field_name},
        )


def require_short_text(value: object, field_name: str, *, max_length: int = 255) -> str:
    text = str(value or "").strip()
    if not text:
        raise ServiceError(
            f"{field_name} is required",
            status_code=400,
            details={"field": field_name},
        )
    if len(text) > max_length:
        raise ServiceError(
            f"{field_name} is too long",
            status_code=400,
            details={"field": field_name, "max_length": max_length},
        )
    return text


def validate_optional_text(value: object, field_name: str, *, max_length: int = 255) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if len(text) > max_length:
        raise ServiceError(
            f"{field_name} is too long",
            status_code=400,
            details={"field": field_name, "max_length": max_length},
        )
    return text


def validate_optional_long_text(value: object, field_name: str) -> str | None:
    if value in (None, ""):
        return None
    return str(value).strip() or None


def validate_optional_email(value: object, field_name: str) -> str | None:
    if value in (None, ""):
        return None
    email = str(value).strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise ServiceError(
            f"Invalid {field_name}",
            status_code=400,
            details={"field": field_name},
        )
    return email


def validate_optional_phone(value: object, field_name: str) -> str | None:
    if value in (None, ""):
        return None
    phone = str(value).strip()
    if len(phone) > 64:
        raise ServiceError(
            f"Invalid {field_name}",
            status_code=400,
            details={"field": field_name},
        )
    return phone


def parse_bool(value: object, field_name: str, *, default: bool | None = None) -> bool:
    if value is None:
        if default is None:
            raise ServiceError(
                f"{field_name} is required",
                status_code=400,
                details={"field": field_name},
            )
        return default
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise ServiceError(
        f"Invalid {field_name}",
        status_code=400,
        details={"field": field_name},
    )


def validate_group_type(value: object) -> str:
    normalized = str(value or "").strip().upper()
    normalized = GROUP_TYPE_ALIASES.get(normalized, normalized)
    if normalized not in GROUP_TYPES:
        raise ServiceError("Invalid group_type", status_code=400, details={"field": "group_type"})
    return normalized


def validate_group_status(value: object, *, default: str = RECIPIENT_GROUP_STATUS_ACTIVE) -> str:
    normalized = str(value or default).strip().upper()
    if normalized not in GROUP_STATUSES:
        raise ServiceError("Invalid status", status_code=400, details={"field": "status"})
    return normalized


def validate_contact_role(value: object) -> str:
    normalized = str(value or GROUP_CONTACT_ROLE_OTHER).strip().upper()
    if normalized not in CONTACT_ROLES:
        raise ServiceError("Invalid contact_role", status_code=400, details={"field": "contact_role"})
    return normalized


def validate_preferred_contact(value: object) -> str:
    normalized = str(value or PREFERRED_CONTACT_NONE).strip().upper()
    if normalized not in PREFERRED_CONTACTS:
        raise ServiceError("Invalid preferred_contact", status_code=400, details={"field": "preferred_contact"})
    return normalized


def validate_recipient_kind(value: object) -> str:
    normalized = str(value or "").strip().upper()
    if normalized not in RECIPIENT_KINDS:
        raise ServiceError("Invalid recipient_kind", status_code=400, details={"field": "recipient_kind"})
    return normalized


def validate_program_type(value: object) -> str:
    normalized = str(value or "").strip().upper()
    normalized = PROGRAM_TYPE_ALIASES.get(normalized, normalized)
    if normalized not in PROGRAM_TYPES:
        raise ServiceError("Invalid program_type", status_code=400, details={"field": "program_type"})
    return normalized


def validate_privacy_level(value: object, *, default: str = RECIPIENT_PRIVACY_LEVEL_ANONYMOUS) -> str:
    normalized = str(value or default).strip().upper()
    if normalized not in RECIPIENT_PRIVACY_LEVELS:
        raise ServiceError("Invalid privacy_level", status_code=400, details={"field": "privacy_level"})
    return normalized


def validate_recipient_status(value: object, *, default: str = RECIPIENT_STATUS_ACTIVE) -> str:
    normalized = str(value or default).strip().upper()
    if normalized not in RECIPIENT_STATUSES:
        raise ServiceError("Invalid status", status_code=400, details={"field": "status"})
    return normalized


def validate_wishlist_status(value: object, *, default: str = WISHLIST_STATUS_DRAFT) -> str:
    normalized = str(value or default).strip().upper()
    if normalized not in WISHLIST_STATUSES:
        raise ServiceError("Invalid wishlist_status", status_code=400, details={"field": "wishlist_status"})
    return normalized


def validate_intake_method(value: object) -> str | None:
    if value in (None, ""):
        return None
    normalized = str(value).strip().upper()
    if normalized not in WISHLIST_INTAKE_METHODS:
        raise ServiceError("Invalid intake_method", status_code=400, details={"field": "intake_method"})
    return normalized


def validate_wishlist_item_type(value: object, *, default: str = WISHLIST_ITEM_TYPE_GIFT) -> str:
    normalized = str(value or default).strip().upper()
    if normalized not in WISHLIST_ITEM_TYPES:
        raise ServiceError("Invalid item_type", status_code=400, details={"field": "item_type"})
    return normalized


def validate_optional_int(value: object, field_name: str, *, minimum: int | None = None, maximum: int | None = None) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ServiceError(
            f"Invalid {field_name}",
            status_code=400,
            details={"field": field_name},
        )
    if minimum is not None and parsed < minimum:
        raise ServiceError(
            f"Invalid {field_name}",
            status_code=400,
            details={"field": field_name, "minimum": minimum},
        )
    if maximum is not None and parsed > maximum:
        raise ServiceError(
            f"Invalid {field_name}",
            status_code=400,
            details={"field": field_name, "maximum": maximum},
        )
    return parsed


def validate_optional_datetime(value: object, field_name: str) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        raise ServiceError(
            f"Invalid {field_name}",
            status_code=400,
            details={"field": field_name},
        )


def validate_program_alignment(*, group_type: str, recipient_kind: str, program_type: str) -> None:
    if recipient_kind == RECIPIENT_KIND_CHILD and program_type != RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY:
        raise ServiceError(
            "Child recipients must use CHILD_FAMILY program_type",
            status_code=400,
            details={"field": "program_type"},
        )
    if recipient_kind == RECIPIENT_KIND_ADULT and program_type != RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM:
        raise ServiceError(
            "Adult recipients must use ADULT_PROGRAM program_type",
            status_code=400,
            details={"field": "program_type"},
        )
    if group_type == RECIPIENT_GROUP_TYPE_HOUSEHOLD and program_type != RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY:
        raise ServiceError(
            "Household groups may only contain CHILD_FAMILY recipients",
            status_code=400,
            details={"field": "program_type"},
        )
    if group_type == RECIPIENT_GROUP_TYPE_ADULT_PROGRAM and program_type != RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM:
        raise ServiceError(
            "Adult program groups may only contain ADULT_PROGRAM recipients",
            status_code=400,
            details={"field": "program_type"},
        )


def validate_recipient_contact_context(
    *,
    group_type: str,
    recipient_kind: str,
    address_line1: str | None,
    address_line2: str | None,
    city: str | None,
    state: str | None,
    postal_code: str | None,
    direct_email: str | None,
    direct_phone: str | None,
) -> None:
    has_direct_contact = any(
        value not in (None, "")
        for value in [address_line1, address_line2, city, state, postal_code, direct_email, direct_phone]
    )
    if group_type == RECIPIENT_GROUP_TYPE_HOUSEHOLD and recipient_kind == RECIPIENT_KIND_CHILD and has_direct_contact:
        raise ServiceError(
            "Household child recipients should not store direct contact details",
            status_code=400,
            details={"field": "direct_contact"},
        )
