from __future__ import annotations

from datetime import date
import re

from app.exceptions.service_error import ServiceError
from app.features.campaigns.constants import (
    CAMPAIGN_CREATEABLE_STATUSES,
    CAMPAIGN_STATUSES,
    CAMPAIGN_STATUS_TRANSITIONS,
)


def require_campaign_name(value: object) -> str:
    name = str(value or "").strip()
    if not name:
        raise ServiceError("Campaign name is required", status_code=400, details={"field": "name"})
    return name


def require_campaign_year(value: object) -> int:
    try:
        year = int(value)
    except (TypeError, ValueError):
        raise ServiceError("Campaign year is required", status_code=400, details={"field": "year"})
    if year < 1900 or year > 3000:
        raise ServiceError("Campaign year is invalid", status_code=400, details={"field": "year"})
    return year


def parse_optional_season_theme(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    if len(text) > 120:
        raise ServiceError(
            "Campaign season_theme is too long",
            status_code=400,
            details={"field": "season_theme"},
        )
    return text


def parse_optional_public_sponsor_slug(value: object) -> str | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    normalized = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if not normalized:
        raise ServiceError(
            "Campaign public_sponsor_slug is invalid",
            status_code=400,
            details={"field": "public_sponsor_slug"},
        )
    if len(normalized) > 120:
        raise ServiceError(
            "Campaign public_sponsor_slug is too long",
            status_code=400,
            details={"field": "public_sponsor_slug"},
        )
    return normalized


def parse_optional_bool(value: object, field_name: str) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise ServiceError(
        f"Invalid boolean for {field_name}",
        status_code=400,
        details={"field": field_name},
    )


def parse_optional_date(value: object, field_name: str) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise ServiceError(
            f"Invalid date for {field_name}",
            status_code=400,
            details={"field": field_name},
        )


def validate_date_order(start_date: date | None, end_date: date | None) -> None:
    if start_date and end_date and end_date < start_date:
        raise ServiceError(
            "Campaign end_date cannot be earlier than start_date",
            status_code=400,
            details={"field": "end_date"},
        )


def validate_create_status(status: object) -> str:
    normalized = str(status or "DRAFT").strip().upper()
    if normalized not in CAMPAIGN_CREATEABLE_STATUSES:
        raise ServiceError(
            "Campaign create status is invalid",
            status_code=400,
            details={"field": "status", "allowed_statuses": sorted(CAMPAIGN_CREATEABLE_STATUSES)},
        )
    return normalized


def validate_status_transition(current_status: str, next_status: str, *, is_app_admin: bool) -> str:
    normalized = str(next_status or "").strip().upper()
    if normalized not in CAMPAIGN_STATUSES:
        raise ServiceError(
            "Campaign status is invalid",
            status_code=400,
            details={"field": "status", "allowed_statuses": sorted(CAMPAIGN_STATUSES)},
        )
    if normalized == current_status:
        return normalized
    if is_app_admin and normalized in CAMPAIGN_STATUS_TRANSITIONS.get(current_status, set()):
        return normalized
    if not is_app_admin and normalized in _default_status_transitions().get(current_status, set()):
        return normalized
    raise ServiceError(
        "Campaign status transition is not allowed",
        status_code=400,
        details={"current_status": current_status, "next_status": normalized},
    )


def _default_status_transitions() -> dict[str, set[str]]:
    return {
        "DRAFT": {"ACTIVE"},
        "ACTIVE": {"CLOSED"},
        "CLOSED": {"ARCHIVED"},
        "ARCHIVED": set(),
    }
