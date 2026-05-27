from __future__ import annotations

from app.exceptions.service_error import ServiceError

MIN_PASSWORD_LENGTH = 8


def require_text(value: object, field: str, *, max_length: int = 255) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ServiceError(f"{field} is required", status_code=400, details={"field": field})
    if len(normalized) > max_length:
        raise ServiceError(
            f"{field} must be {max_length} characters or fewer",
            status_code=400,
            details={"field": field, "max_length": max_length},
        )
    return normalized


def require_email(value: object) -> str:
    normalized = require_text(value, "email").lower()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ServiceError("email is invalid", status_code=400, details={"field": "email"})
    return normalized


def validate_global_role(value: object) -> str:
    normalized = require_text(value, "role", max_length=32).upper()
    if normalized not in {"ADMIN", "COORDINATOR"}:
        raise ServiceError("role is invalid", status_code=400, details={"field": "role"})
    return normalized


def validate_password(value: object) -> str:
    normalized = str(value or "")
    if len(normalized) < MIN_PASSWORD_LENGTH:
        raise ServiceError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
            status_code=400,
            details={"field": "password"},
        )
    return normalized


def validate_feature_key(value: object) -> str:
    return require_text(value, "feature_key", max_length=64)


def validate_provider(value: object) -> str:
    normalized = require_text(value, "provider", max_length=64).upper()
    if normalized not in {"OPENAI_COMPATIBLE", "OPENAI"}:
        raise ServiceError("provider is invalid", status_code=400, details={"field": "provider"})
    return normalized
