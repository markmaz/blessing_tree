from __future__ import annotations

import re
from collections.abc import Mapping

from app.exceptions.service_error import ServiceError
from app.features.campaigns.readiness_definition_constants import (
    CAMPAIGN_MILESTONE_FEATURE_AREAS,
    CAMPAIGN_READINESS_ALLOWED_CAMPAIGN_FIELDS,
    CAMPAIGN_READINESS_CATEGORIES,
    CAMPAIGN_READINESS_CONDITION_TYPES,
    CAMPAIGN_READINESS_PHASES,
    CAMPAIGN_READINESS_RULE_TYPES,
    CAMPAIGN_READINESS_SECTIONS,
    CAMPAIGN_READINESS_SEVERITIES,
)

KEY_RE = re.compile(r"^[a-z0-9_]+$")


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


def optional_text(value: object, *, max_length: int = 512) -> str | None:
    if value in (None, ""):
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise ServiceError("Text value is too long", status_code=400, details={"max_length": max_length})
    return normalized


def validate_key(value: object, field: str, *, max_length: int = 120) -> str:
    normalized = require_text(value, field, max_length=max_length).lower()
    if not KEY_RE.match(normalized):
        raise ServiceError(
            f"{field} may only contain lowercase letters, numbers, and underscores",
            status_code=400,
            details={"field": field},
        )
    return normalized


def validate_feature_area(value: object) -> str:
    normalized = require_text(value or "GENERAL", "feature_area", max_length=32).upper()
    if normalized not in CAMPAIGN_MILESTONE_FEATURE_AREAS:
        raise ServiceError("feature_area is invalid", status_code=400, details={"field": "feature_area"})
    return normalized


def validate_bool(value: object, *, default: bool = True) -> bool:
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return bool(value)
    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off"}:
        return False
    raise ServiceError("Boolean value is invalid", status_code=400)


def validate_sort_order(value: object) -> int:
    if value in (None, ""):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ServiceError("default_sort_order is invalid", status_code=400, details={"field": "default_sort_order"})


def validate_milestone_definition_payload(payload: Mapping[str, object], *, partial: bool = False) -> dict[str, object]:
    values: dict[str, object] = {}
    if not partial or "milestone_key" in payload:
        values["milestone_key"] = validate_key(payload.get("milestone_key"), "milestone_key", max_length=64)
    if not partial or "label" in payload:
        values["label"] = require_text(payload.get("label"), "label")
    if "description" in payload:
        values["description"] = optional_text(payload.get("description"))
    if not partial or "feature_area" in payload:
        values["feature_area"] = validate_feature_area(payload.get("feature_area"))
    if not partial or "default_sort_order" in payload:
        values["default_sort_order"] = validate_sort_order(payload.get("default_sort_order"))
    if "is_active" in payload:
        values["is_active"] = validate_bool(payload.get("is_active"))
    if "is_system" in payload:
        values["is_system"] = validate_bool(payload.get("is_system"), default=False)
    return values


def validate_rule_type(value: object) -> str:
    normalized = require_text(value, "rule_type", max_length=64).upper()
    if normalized not in CAMPAIGN_READINESS_RULE_TYPES:
        raise ServiceError("rule_type is invalid", status_code=400, details={"field": "rule_type"})
    return normalized


def validate_condition_type(value: object) -> str:
    normalized = require_text(value or "ALWAYS", "condition_type", max_length=64).upper()
    if normalized not in CAMPAIGN_READINESS_CONDITION_TYPES:
        raise ServiceError("condition_type is invalid", status_code=400, details={"field": "condition_type"})
    return normalized


def validate_condition_config(condition_type: str, value: object) -> dict[str, object] | None:
    config = value if isinstance(value, Mapping) else {}
    if condition_type == "ALWAYS":
        return None
    if condition_type == "CAMPAIGN_FIELD_TRUE":
        field = require_text(config.get("field"), "condition_config.field", max_length=64)
        if field not in CAMPAIGN_READINESS_ALLOWED_CAMPAIGN_FIELDS:
            raise ServiceError(
                "condition_config.field is invalid",
                status_code=400,
                details={"field": "condition_config.field"},
            )
        return {"field": field}
    if condition_type == "CAMPAIGN_STATUS_IS":
        status = require_text(config.get("status"), "condition_config.status", max_length=32).upper()
        if status not in {"DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"}:
            raise ServiceError("condition_config.status is invalid", status_code=400, details={"field": "condition_config.status"})
        return {"status": status}
    if condition_type == "FEATURE_ENABLED":
        feature_key = require_text(config.get("feature_key"), "condition_config.feature_key", max_length=64)
        return {"feature_key": feature_key}
    return None


def validate_severity(value: object) -> str:
    normalized = require_text(value, "severity", max_length=32).lower()
    if normalized not in CAMPAIGN_READINESS_SEVERITIES:
        raise ServiceError("severity is invalid", status_code=400, details={"field": "severity"})
    return normalized


def validate_category(value: object) -> str:
    normalized = require_text(value, "category", max_length=64).lower()
    if normalized not in CAMPAIGN_READINESS_CATEGORIES:
        raise ServiceError("category is invalid", status_code=400, details={"field": "category"})
    return normalized


def validate_blocking_for(value: object) -> list[str]:
    raw = value if isinstance(value, list) else []
    phases = [str(item).strip().lower() for item in raw if str(item).strip()]
    if any(phase not in CAMPAIGN_READINESS_PHASES for phase in phases):
        raise ServiceError("blocking_for contains an invalid phase", status_code=400, details={"field": "blocking_for"})
    return list(dict.fromkeys(phases))


def validate_section(value: object) -> str:
    normalized = require_text(value, "section", max_length=64).lower()
    if normalized not in CAMPAIGN_READINESS_SECTIONS:
        raise ServiceError("section is invalid", status_code=400, details={"field": "section"})
    return normalized


def validate_readiness_rule_payload(payload: Mapping[str, object], *, partial: bool = False) -> dict[str, object]:
    values: dict[str, object] = {}
    if not partial or "rule_key" in payload:
        values["rule_key"] = validate_key(payload.get("rule_key"), "rule_key")
    if not partial or "name" in payload:
        values["name"] = require_text(payload.get("name"), "name")
    if "description" in payload:
        values["description"] = optional_text(payload.get("description"))
    if not partial or "rule_type" in payload:
        values["rule_type"] = validate_rule_type(payload.get("rule_type"))
    if not partial or "feature_area" in payload:
        values["feature_area"] = validate_feature_area(payload.get("feature_area"))
    condition_type = validate_condition_type(payload.get("condition_type")) if (not partial or "condition_type" in payload) else None
    if condition_type is not None:
        values["condition_type"] = condition_type
    if condition_type is not None or "condition_config" in payload:
        next_condition_type = condition_type or str(payload.get("existing_condition_type") or "ALWAYS")
        values["condition_config_json"] = validate_condition_config(next_condition_type, payload.get("condition_config"))
    if not partial or "milestone_key" in payload:
        values["milestone_key"] = validate_key(payload.get("milestone_key"), "milestone_key", max_length=64)
    if not partial or "severity" in payload:
        values["severity"] = validate_severity(payload.get("severity"))
    if not partial or "category" in payload:
        values["category"] = validate_category(payload.get("category"))
    if not partial or "blocking_for" in payload:
        values["blocking_for_json"] = validate_blocking_for(payload.get("blocking_for"))
    if not partial or "section" in payload:
        values["section"] = validate_section(payload.get("section"))
    if "action_label" in payload:
        values["action_label"] = optional_text(payload.get("action_label"), max_length=120)
    if not partial or "message" in payload:
        values["message"] = require_text(payload.get("message"), "message", max_length=512)
    if "is_active" in payload:
        values["is_active"] = validate_bool(payload.get("is_active"))
    if "is_system" in payload:
        values["is_system"] = validate_bool(payload.get("is_system"), default=False)
    return values
