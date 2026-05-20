from __future__ import annotations

from typing import Any, Mapping

from flask import request

from app.exceptions.service_error import ServiceError


def resolve_campaign_scope_id(
    *,
    campaign_id_arg: str = "campaign_id",
    route_kwargs: Mapping[str, Any] | None = None,
    allow_query_fallback: bool = False,
    allow_body_fallback: bool = False,
) -> str:
    value = _coerce_non_empty((route_kwargs or {}).get(campaign_id_arg))
    if value:
        return value

    view_args = getattr(request, "view_args", None) or {}
    value = _coerce_non_empty(view_args.get(campaign_id_arg))
    if value:
        return value

    if allow_query_fallback:
        value = _coerce_non_empty(request.args.get(campaign_id_arg))
        if value:
            return value

    if allow_body_fallback:
        payload = request.get_json(silent=True)
        if isinstance(payload, dict):
            value = _coerce_non_empty(payload.get(campaign_id_arg))
            if value:
                return value

    raise ServiceError(
        "Missing campaign scope",
        status_code=400,
        details={"code": "missing_campaign_scope", "campaign_id_arg": campaign_id_arg},
    )


def _coerce_non_empty(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
