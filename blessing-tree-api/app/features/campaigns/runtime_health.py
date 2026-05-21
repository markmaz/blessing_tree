from __future__ import annotations

from datetime import UTC, datetime

from app.adapters.valkey_client import get_client
from app.config import BT_CAMPAIGN_AUTOMATION_HEARTBEAT_TTL_SECONDS
from app.features.campaigns.automation_constants import CAMPAIGN_AUTOMATION_HEARTBEAT_KEY


def record_campaign_worker_heartbeat(*, task_name: str) -> None:
    payload = f"{task_name}|{datetime.now(UTC).isoformat()}"
    try:
        get_client().set(
            CAMPAIGN_AUTOMATION_HEARTBEAT_KEY,
            payload,
            ex=max(BT_CAMPAIGN_AUTOMATION_HEARTBEAT_TTL_SECONDS, 60),
        )
    except Exception:
        return


def campaign_worker_is_healthy() -> bool:
    try:
        value = get_client().get(CAMPAIGN_AUTOMATION_HEARTBEAT_KEY)
    except Exception:
        return False
    return bool(value)
