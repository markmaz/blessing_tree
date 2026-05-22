from __future__ import annotations

import uuid
from collections.abc import Iterable, Mapping
from datetime import date, datetime

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import _optional_text
from app.features.campaigns.studio_constants import (
    CAMPAIGN_EVENT_TYPES,
    COMMUNICATION_AUDIENCE_ALIASES,
    COMMUNICATION_AUDIENCES,
    COMMUNICATION_CHANNELS,
    COMMUNICATION_SCHEDULE_STATUSES,
    MILESTONE_DEFINITIONS,
)
from app.features.rbac.constants import CAMPAIGN_ROLE_CAPABILITIES, normalize_campaign_role_key


def require_user_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        raise ServiceError("Valid user_id is required", status_code=400, details={"field": "user_id"})


def validate_role_key(value: object) -> str:
    role_key = normalize_campaign_role_key(str(value or ""))
    if role_key not in CAMPAIGN_ROLE_CAPABILITIES:
        raise ServiceError(
            "Campaign role_key is invalid",
            status_code=400,
            details={"field": "role_key", "allowed_role_keys": sorted(CAMPAIGN_ROLE_CAPABILITIES.keys())},
        )
    return role_key


def parse_bool(value: object, field_name: str, *, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise ServiceError(f"Invalid boolean for {field_name}", status_code=400, details={"field": field_name})


def validate_template_key(value: object) -> str:
    template_key = str(value or "").strip().lower().replace(" ", "_")
    if not template_key:
        raise ServiceError("Template key is required", status_code=400, details={"field": "template_key"})
    return template_key


def require_short_text(value: object, field_name: str, *, max_length: int = 255) -> str:
    text = str(value or "").strip()
    if not text:
        raise ServiceError(f"{field_name} is required", status_code=400, details={"field": field_name})
    if len(text) > max_length:
        raise ServiceError(
            f"{field_name} exceeds max length",
            status_code=400,
            details={"field": field_name, "max_length": max_length},
        )
    return text


def validate_audience(value: object) -> str:
    audience = str(value or "GENERAL").strip().upper()
    audience = COMMUNICATION_AUDIENCE_ALIASES.get(audience, audience)
    if audience not in COMMUNICATION_AUDIENCES:
        raise ServiceError(
            "Communication audience is invalid",
            status_code=400,
            details={"field": "audience", "allowed_values": sorted(COMMUNICATION_AUDIENCES)},
        )
    return audience


def validate_channel(value: object) -> str:
    channel = str(value or "EMAIL").strip().upper()
    if channel not in COMMUNICATION_CHANNELS:
        raise ServiceError(
            "Communication channel is invalid",
            status_code=400,
            details={"field": "channel", "allowed_values": sorted(COMMUNICATION_CHANNELS)},
        )
    return channel


def parse_optional_datetime(value: object, field_name: str) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        raise ServiceError(f"Invalid datetime for {field_name}", status_code=400, details={"field": field_name})


def parse_required_datetime(value: object, field_name: str) -> datetime:
    parsed = parse_optional_datetime(value, field_name)
    if parsed is None:
        raise ServiceError(f"{field_name} is required", status_code=400, details={"field": field_name})
    return parsed


def validate_schedule_status(value: object) -> str:
    status = str(value or "DRAFT").strip().upper()
    if status not in COMMUNICATION_SCHEDULE_STATUSES:
        raise ServiceError(
            "Communication schedule status is invalid",
            status_code=400,
            details={"field": "status", "allowed_values": sorted(COMMUNICATION_SCHEDULE_STATUSES)},
        )
    return status


def validate_event_type(value: object) -> str:
    event_type = str(value or "GENERAL").strip().upper()
    if event_type not in CAMPAIGN_EVENT_TYPES:
        raise ServiceError(
            "Campaign event_type is invalid",
            status_code=400,
            details={"field": "event_type", "allowed_values": sorted(CAMPAIGN_EVENT_TYPES)},
        )
    return event_type


def validate_milestone_key(value: object) -> str:
    milestone_key = str(value or "").strip()
    if milestone_key not in MILESTONE_DEFINITIONS:
        raise ServiceError(
            "Milestone key is invalid",
            status_code=400,
            details={"field": "milestone_key", "allowed_values": sorted(MILESTONE_DEFINITIONS.keys())},
        )
    return milestone_key


def parse_required_date(value: object, field_name: str) -> date:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ServiceError(f"Invalid date for {field_name}", status_code=400, details={"field": field_name})


def validate_milestone_payload(payload: Mapping[str, object]) -> dict[str, object]:
    milestone_key = validate_milestone_key(payload.get("milestone_key"))
    return {
        "milestone_key": milestone_key,
        "label": require_short_text(payload.get("label") or MILESTONE_DEFINITIONS[milestone_key], "label"),
        "occurs_on": parse_required_date(payload.get("occurs_on"), "occurs_on"),
        "notes": _optional_text(payload.get("notes")),
        "sort_order": _parse_sort_order(payload.get("sort_order")),
    }


def require_milestone_list(payload: object) -> list[dict[str, object]]:
    raw_items: object = payload.get("milestones") if isinstance(payload, Mapping) else payload
    if not isinstance(raw_items, Iterable) or isinstance(raw_items, (str, bytes, dict)):
        raise ServiceError("Milestones payload must be a list", status_code=400, details={"field": "milestones"})

    raw_list = list(raw_items)
    items = [validate_milestone_payload(item) for item in raw_list if isinstance(item, Mapping)]
    if len(items) != len(raw_list):
        raise ServiceError("Each milestone must be an object", status_code=400, details={"field": "milestones"})

    keys = [item["milestone_key"] for item in items]
    if len(set(keys)) != len(keys):
        raise ServiceError("Milestone keys must be unique", status_code=400, details={"field": "milestones"})
    return items


def _parse_sort_order(value: object) -> int:
    if value in (None, ""):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ServiceError("sort_order must be an integer", status_code=400, details={"field": "sort_order"})


def validate_datetime_range(
    start_at: datetime,
    end_at: datetime | None,
    *,
    start_field: str = "start_at",
    end_field: str = "end_at",
) -> None:
    if end_at is not None and end_at < start_at:
        raise ServiceError(
            f"{end_field} must be on or after {start_field}",
            status_code=400,
            details={"fields": [start_field, end_field]},
        )
