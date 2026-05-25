from __future__ import annotations

import secrets
import string
from datetime import datetime

from app.exceptions.service_error import ServiceError
from app.features.recipients.validation import (
    parse_bool,
    require_short_text,
    require_uuid,
    validate_optional_datetime,
    validate_optional_email,
    validate_optional_long_text,
    validate_optional_phone,
    validate_optional_postal_code,
    validate_optional_state,
    validate_optional_text,
    validate_preferred_contact,
)
from app.models.sponsor_constants import (
    PENDING_SPONSOR_REGISTRATION_STATUSES,
    SPONSOR_INTERACTION_ORIGINS,
    SPONSOR_SOURCES,
    SPONSORSHIP_DROP_OFF_STATUSES,
    SPONSORSHIP_INTEREST_STATUSES,
    SPONSORSHIP_STATUSES,
)

SPONSOR_INTERACTION_CHANNELS = {"CALL", "EMAIL", "TEXT", "IN_PERSON"}
SPONSOR_INTERACTION_DIRECTIONS = {"OUTBOUND", "INBOUND"}
SPONSOR_INTERACTION_OUTCOMES = {
    "LEFT_VM",
    "NO_ANSWER",
    "REACHED",
    "BOUNCED",
    "WRONG_NUMBER",
    "PROMISED_DATE",
    "COMPLETED",
    "OTHER",
}


def validate_sponsor_source(value: object, *, default: str = "STAFF_ENTRY") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in SPONSOR_SOURCES:
        raise ServiceError("Invalid source", status_code=400, details={"field": "source"})
    return normalized


def validate_sponsorship_status(value: object, *, default: str = "ACTIVE") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in SPONSORSHIP_STATUSES:
        raise ServiceError("Invalid sponsorship status", status_code=400, details={"field": "status"})
    return normalized


def validate_interest_status(value: object, *, default: str = "NEW") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in SPONSORSHIP_INTEREST_STATUSES:
        raise ServiceError("Invalid interest status", status_code=400, details={"field": "interest_status"})
    return normalized


def validate_drop_off_status(value: object, *, default: str = "NOT_STARTED") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in SPONSORSHIP_DROP_OFF_STATUSES:
        raise ServiceError("Invalid drop off status", status_code=400, details={"field": "drop_off_status"})
    return normalized


def validate_sponsor_code(value: object) -> str | None:
    code = validate_optional_text(value, "sponsor_code", max_length=64)
    return code.upper() if code else None


def validate_interaction_channel(value: object) -> str:
    normalized = str(value or "").strip().upper()
    if normalized not in SPONSOR_INTERACTION_CHANNELS:
        raise ServiceError("Invalid interaction channel", status_code=400, details={"field": "channel"})
    return normalized


def validate_interaction_direction(value: object, *, default: str = "OUTBOUND") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in SPONSOR_INTERACTION_DIRECTIONS:
        raise ServiceError("Invalid interaction direction", status_code=400, details={"field": "direction"})
    return normalized


def validate_interaction_outcome(value: object, *, default: str = "OTHER") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in SPONSOR_INTERACTION_OUTCOMES:
        raise ServiceError("Invalid interaction outcome", status_code=400, details={"field": "outcome"})
    return normalized


def validate_interaction_origin(value: object, *, default: str = "MANUAL") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in SPONSOR_INTERACTION_ORIGINS:
        raise ServiceError("Invalid interaction origin", status_code=400, details={"field": "origin_type"})
    return normalized


def validate_pending_registration_status(value: object, *, default: str = "PENDING") -> str:
    if value in (None, ""):
        return default
    normalized = str(value).strip().upper()
    if normalized not in PENDING_SPONSOR_REGISTRATION_STATUSES:
        raise ServiceError("Invalid pending registration status", status_code=400, details={"field": "status"})
    return normalized


def validate_selected_wishlist_item_ids(value: object, *, max_items: int = 3) -> list[str]:
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise ServiceError("selected_wishlist_item_ids must be a list", status_code=400, details={"field": "selected_wishlist_item_ids"})
    if len(value) > max_items:
        raise ServiceError(
            f"selected_wishlist_item_ids may not contain more than {max_items} items",
            status_code=400,
            details={"field": "selected_wishlist_item_ids", "max_items": max_items},
        )
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in value:
        item_id = str(require_uuid(raw, "selected_wishlist_item_ids"))
        if item_id in seen:
            continue
        seen.add(item_id)
        normalized.append(item_id)
    return normalized


def derive_sponsor_display_name(
    *,
    display_name: object,
    first_name: object,
    last_name: object,
    organization_name: object,
    email: object,
) -> str:
    explicit = validate_optional_text(display_name, "display_name")
    if explicit:
        return explicit
    first = validate_optional_text(first_name, "first_name", max_length=128)
    last = validate_optional_text(last_name, "last_name", max_length=128)
    if first and last:
        return require_short_text(f"{first} {last}", "display_name")
    if first:
        return require_short_text(first, "display_name")
    organization = validate_optional_text(organization_name, "organization_name")
    if organization:
        return require_short_text(organization, "display_name")
    normalized_email = validate_optional_email(email, "email")
    if normalized_email:
        return require_short_text(normalized_email, "display_name")
    raise ServiceError("display_name is required", status_code=400, details={"field": "display_name"})


def generate_public_verification_token(length: int = 48) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def validate_sponsor_payload(payload: dict[str, object], *, for_update: bool = False) -> dict[str, object]:
    first_name = validate_optional_text(payload.get("first_name"), "first_name", max_length=128)
    last_name = validate_optional_text(payload.get("last_name"), "last_name", max_length=128)
    organization_name = validate_optional_text(payload.get("organization_name"), "organization_name")
    email = validate_optional_email(payload.get("email"), "email")
    phone = validate_optional_phone(payload.get("phone"), "phone")
    display_name = derive_sponsor_display_name(
        display_name=payload.get("display_name"),
        first_name=first_name,
        last_name=last_name,
        organization_name=organization_name,
        email=email,
    )
    return {
        "first_name": first_name,
        "last_name": last_name,
        "display_name": display_name,
        "organization_name": organization_name,
        "email": email,
        "phone": phone,
        "address_line1": validate_optional_text(payload.get("address_line1"), "address_line1"),
        "address_line2": validate_optional_text(payload.get("address_line2"), "address_line2"),
        "city": validate_optional_text(payload.get("city"), "city", max_length=128),
        "state": validate_optional_state(payload.get("state"), "state"),
        "postal_code": validate_optional_postal_code(payload.get("postal_code"), "postal_code"),
        "preferred_contact": validate_preferred_contact(payload.get("preferred_contact")),
        "source": validate_sponsor_source(payload.get("source"), default="STAFF_ENTRY"),
        "source_detail": validate_optional_text(payload.get("source_detail"), "source_detail"),
        "notes": validate_optional_long_text(payload.get("notes"), "notes"),
        "is_active": parse_bool(payload.get("is_active"), "is_active", default=True),
        "do_not_contact": parse_bool(payload.get("do_not_contact"), "do_not_contact", default=False),
        "self_registered_at": validate_optional_datetime(payload.get("self_registered_at"), "self_registered_at"),
        "last_contacted_at": validate_optional_datetime(payload.get("last_contacted_at"), "last_contacted_at"),
    }


def validate_sponsorship_payload(payload: dict[str, object]) -> dict[str, object]:
    return {
        "status": validate_sponsorship_status(payload.get("status")),
        "interest_status": validate_interest_status(payload.get("interest_status")),
        "drop_off_status": validate_drop_off_status(payload.get("drop_off_status")),
        "drop_off_due_at": validate_optional_datetime(payload.get("drop_off_due_at"), "drop_off_due_at"),
        "drop_off_completed_at": validate_optional_datetime(payload.get("drop_off_completed_at"), "drop_off_completed_at"),
        "self_registered": parse_bool(payload.get("self_registered"), "self_registered", default=False),
        "sponsor_code": validate_sponsor_code(payload.get("sponsor_code")),
        "notes": validate_optional_long_text(payload.get("participation_notes") if "participation_notes" in payload else payload.get("notes"), "notes"),
    }


def validate_interaction_payload(payload: dict[str, object]) -> dict[str, object]:
    return {
        "channel": validate_interaction_channel(payload.get("channel")),
        "direction": validate_interaction_direction(payload.get("direction")),
        "subject": validate_optional_text(payload.get("subject"), "subject"),
        "origin_type": validate_interaction_origin(payload.get("origin_type"), default="MANUAL"),
        "outcome": validate_interaction_outcome(payload.get("outcome")),
        "notes": validate_optional_long_text(payload.get("notes"), "notes"),
        "occurred_at": validate_optional_datetime(payload.get("occurred_at"), "occurred_at") or datetime.utcnow(),
        "follow_up_at": validate_optional_datetime(payload.get("follow_up_at"), "follow_up_at"),
        "related_sponsorship_id": str(require_uuid(payload.get("related_sponsorship_id"), "related_sponsorship_id")) if payload.get("related_sponsorship_id") else None,
        "related_schedule_id": str(require_uuid(payload.get("related_schedule_id"), "related_schedule_id")) if payload.get("related_schedule_id") else None,
        "related_delivery_attempt_id": validate_optional_text(payload.get("related_delivery_attempt_id"), "related_delivery_attempt_id"),
        "external_message_id": validate_optional_text(payload.get("external_message_id"), "external_message_id"),
    }
