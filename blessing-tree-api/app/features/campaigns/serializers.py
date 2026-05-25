from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.models.campaign import Campaign


def serialize_campaign(campaign: Campaign) -> dict[str, Any]:
    return {
        "id": str(campaign.id),
        "name": campaign.name,
        "year": campaign.year,
        "description": campaign.description,
        "season_theme": campaign.season_theme,
        "public_sponsor_slug": campaign.public_sponsor_slug,
        "public_sponsor_signup_enabled": bool(campaign.public_sponsor_signup_enabled),
        "status": campaign.status,
        "start_date": _serialize_date(campaign.start_date),
        "end_date": _serialize_date(campaign.end_date),
        "created_at": _serialize_datetime(campaign.created_at),
        "updated_at": _serialize_datetime(campaign.updated_at),
    }


def serialize_campaign_list_item(campaign: Campaign, user_access: dict[str, Any]) -> dict[str, Any]:
    payload = serialize_campaign(campaign)
    payload.pop("created_at", None)
    payload.pop("updated_at", None)
    payload["user_access"] = user_access
    return payload


def serialize_campaign_access(
    campaign_id: str,
    global_app_role: str,
    role_keys: set[str],
    capabilities: set[str],
) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "global_app_role": global_app_role,
        "role_keys": sorted(role_keys),
        "capabilities": sorted(capabilities),
    }


def serialize_campaign_summary(campaign_id: str, counts: dict[str, int]) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "counts": counts,
    }


def _serialize_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
