from __future__ import annotations

import re
from typing import Any

from app.features.ask.schemas import ExtractedEntities

GENDER_ALIASES = {
    "girl": "F",
    "girls": "F",
    "female": "F",
    "boy": "M",
    "boys": "M",
    "male": "M",
}

STATUS_ALIASES = {
    "open": "OPEN",
    "reserved": "RESERVED",
    "committed": "COMMITTED",
    "received": "RECEIVED",
    "wrapped": "WRAPPED",
    "tagged": "TAGGED",
    "ready": "READY_FOR_DISTRIBUTION",
    "distributed": "DISTRIBUTED",
    "picked up": "PICKED_UP",
    "pickup": "PICKED_UP",
    "exception": "EXCEPTION",
}


def normalize_prompt(prompt: str) -> str:
    return re.sub(r"\s+", " ", prompt.strip().lower())


def extract_entities(prompt: str) -> ExtractedEntities:
    text = normalize_prompt(prompt)
    result = ExtractedEntities(intent=_extract_intent(text))
    _extract_age(text, result)
    _extract_gender(text, result)
    _extract_status(text, result)
    _extract_category(text, result)
    return result


def merge_entities(primary: ExtractedEntities, secondary: ExtractedEntities) -> ExtractedEntities:
    merged = ExtractedEntities(
        intent=primary.intent or secondary.intent,
        filters=dict(primary.filters),
        filter_chips=list(primary.filter_chips),
        warnings=[*primary.warnings, *secondary.warnings],
    )
    for key, value in secondary.filters.items():
        if key not in merged.filters:
            merged.filters[key] = value
            chip = _chip_for(key, value)
            if chip and chip not in merged.filter_chips:
                merged.filter_chips.append(chip)
        elif merged.filters[key] != value:
            merged.warnings.append(f"I found conflicting values for {key.replace('_', ' ')}.")
    return merged


def entities_from_llm_payload(payload: dict[str, Any]) -> ExtractedEntities:
    entities = payload.get("entities")
    if not isinstance(entities, dict):
        entities = payload.get("filters") if isinstance(payload.get("filters"), dict) else {}
    result = ExtractedEntities(intent=_validated_intent(payload.get("intent")))
    for key in ("age_min", "age_max"):
        value = _to_int(entities.get(key))
        if value is not None:
            result.filters[key] = value
            result.filter_chips.append(_chip_for(key, value))
    gender = _normalize_gender(entities.get("gender"))
    if gender:
        result.filters["gender"] = gender
        result.filter_chips.append(_chip_for("gender", gender))
    status = _normalize_status(entities.get("status"))
    if status:
        result.filters["status"] = status
        result.filter_chips.append(_chip_for("status", status))
    category = _normalize_text(entities.get("category"))
    if category:
        result.filters["category"] = category
        result.filter_chips.append(_chip_for("category", category))
    return result


def _extract_intent(text: str) -> str:
    if any(phrase in text for phrase in ("how many", "count", "number of")):
        return "count"
    if any(phrase in text for phrase in ("where", "open ", "take me", "go to")):
        return "navigate"
    if any(phrase in text for phrase in ("how do i", "how to", "help", "what is")):
        return "help"
    return "list"


def _extract_age(text: str, result: ExtractedEntities) -> None:
    range_match = re.search(r"\bage(?:s|d)?\s*(\d{1,2})\s*(?:-|to|through)\s*(\d{1,2})\b", text)
    if not range_match:
        range_match = re.search(r"\b(\d{1,2})\s*(?:-|to|through)\s*(\d{1,2})\s*(?:years?|yrs?|yo)?\b", text)
    if range_match:
        age_min = int(range_match.group(1))
        age_max = int(range_match.group(2))
        result.filters["age_min"] = min(age_min, age_max)
        result.filters["age_max"] = max(age_min, age_max)
        result.filter_chips.append(f"Age {result.filters['age_min']}-{result.filters['age_max']}")
        return

    under_match = re.search(r"\b(?:under|younger than)\s*(\d{1,2})\b", text)
    if under_match:
        result.filters["age_max"] = int(under_match.group(1)) - 1
        result.filter_chips.append(f"Under {under_match.group(1)}")
        return

    over_match = re.search(r"\b(?:over|older than)\s*(\d{1,2})\b", text)
    if over_match:
        result.filters["age_min"] = int(over_match.group(1)) + 1
        result.filter_chips.append(f"Over {over_match.group(1)}")
        return

    exact_match = re.search(r"\bage(?:s|d)?\s*(\d{1,2})\b", text)
    if exact_match:
        age = int(exact_match.group(1))
        result.filters["age_min"] = age
        result.filters["age_max"] = age
        result.filter_chips.append(f"Age {age}")


def _extract_gender(text: str, result: ExtractedEntities) -> None:
    for alias, value in GENDER_ALIASES.items():
        if re.search(rf"\b{re.escape(alias)}\b", text):
            result.filters["gender"] = value
            result.filter_chips.append("Girls" if value == "F" else "Boys")
            return


def _extract_status(text: str, result: ExtractedEntities) -> None:
    for alias, value in STATUS_ALIASES.items():
        if alias in text:
            result.filters["status"] = value
            result.filter_chips.append(_chip_for("status", value))
            return


def _extract_category(text: str, result: ExtractedEntities) -> None:
    categories = ("coat", "coats", "toy", "toys", "clothing", "gift card", "book", "books", "shoes")
    for category in categories:
        if category in text:
            result.filters["category"] = category.rstrip("s")
            result.filter_chips.append(category.title())
            return


def _validated_intent(value: object) -> str | None:
    text = _normalize_text(value)
    return text if text in {"count", "list", "navigate", "help"} else None


def _normalize_gender(value: object) -> str | None:
    text = _normalize_text(value)
    if not text:
        return None
    if text in {"F", "M", "X", "U"}:
        return text
    return GENDER_ALIASES.get(text.lower())


def _normalize_status(value: object) -> str | None:
    text = _normalize_text(value)
    if not text:
        return None
    upper = text.upper()
    if upper in set(STATUS_ALIASES.values()):
        return upper
    return STATUS_ALIASES.get(text.lower())


def _normalize_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _to_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _chip_for(key: str, value: object) -> str:
    if key == "gender":
        return "Girls" if value == "F" else "Boys" if value == "M" else "Gender specified"
    if key == "status":
        return str(value).replace("_", " ").title()
    if key == "category":
        return str(value).title()
    if key == "age_min":
        return f"Age {value}+"
    if key == "age_max":
        return f"Age up to {value}"
    return str(value)
