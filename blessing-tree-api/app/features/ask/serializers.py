from __future__ import annotations

from typing import Any

from app.features.ask.navigation_catalog import build_route
from app.features.ask.schemas import AskAction, ExtractedEntities


def serialize_action(action: AskAction, *, campaign_id: str) -> dict[str, Any]:
    route = action.route
    if route is None and action.route_name:
        route = build_route(action.route_name, campaign_id)
    return {
        "type": action.type,
        "label": action.label,
        "route": route,
        "prompt": action.prompt,
        "required_capability": action.required_capability,
    }


def serialize_entities(entities: ExtractedEntities, *, subject: str | None = None) -> dict[str, Any]:
    return {
        "intent": entities.intent,
        "subject": subject,
        "filters": entities.filters,
        "filter_chips": entities.filter_chips,
    }
