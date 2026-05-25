from __future__ import annotations

from app.exceptions.service_error import ServiceError

DATE_FORMATS = {"MM_DD_YYYY", "YYYY_MM_DD"}
DEFAULT_LANDING_PAGES = {"DASHBOARD", "CAMPAIGNS", "CURRENT_CAMPAIGN"}


def validate_display_name(value: object) -> str:
    name = str(value or "").strip()
    if not name:
        raise ServiceError("Display name is required", status_code=400, details={"field": "display_name"})
    if len(name) > 255:
        raise ServiceError("Display name is too long", status_code=400, details={"field": "display_name"})
    return name


def validate_timezone(value: object) -> str:
    timezone = str(value or "").strip()
    if not timezone:
        raise ServiceError("Timezone is required", status_code=400, details={"field": "timezone"})
    if len(timezone) > 64 or any(character.isspace() for character in timezone):
        raise ServiceError("Timezone is invalid", status_code=400, details={"field": "timezone"})
    return timezone


def validate_date_format(value: object) -> str:
    date_format = str(value or "").strip().upper()
    if date_format not in DATE_FORMATS:
        raise ServiceError(
            "Date format is invalid",
            status_code=400,
            details={"field": "date_format", "allowed": sorted(DATE_FORMATS)},
        )
    return date_format


def validate_default_landing_page(value: object) -> str:
    landing_page = str(value or "").strip().upper()
    if landing_page not in DEFAULT_LANDING_PAGES:
        raise ServiceError(
            "Default landing page is invalid",
            status_code=400,
            details={"field": "default_landing_page", "allowed": sorted(DEFAULT_LANDING_PAGES)},
        )
    return landing_page


def parse_bool(value: object, field_name: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in {0, 1}:
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
    raise ServiceError(f"Invalid boolean for {field_name}", status_code=400, details={"field": field_name})
