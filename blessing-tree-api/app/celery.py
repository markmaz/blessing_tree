from __future__ import annotations

import os

from celery import Celery

from app.config import (
    BT_CAMPAIGN_AUTOMATION_POLL_SECONDS,
    BT_CAMPAIGN_LIFECYCLE_POLL_SECONDS,
    BT_CELERY_WORKER_CONCURRENCY,
    BT_CELERY_WORKER_POOL,
    IS_DARWIN,
    VALKEY_CONFIG,
)

if IS_DARWIN:
    os.environ.setdefault("CELERYD_POOL", BT_CELERY_WORKER_POOL)
    os.environ.setdefault("CELERYD_CONCURRENCY", str(BT_CELERY_WORKER_CONCURRENCY))

celery = Celery(__name__, broker=VALKEY_CONFIG, backend=VALKEY_CONFIG)
celery.autodiscover_tasks(["app.tasks"])

_default_pool = "solo" if IS_DARWIN else "prefork"
_selected_pool = (BT_CELERY_WORKER_POOL or _default_pool).strip().lower() or _default_pool
_config_update: dict[str, object] = {
    "worker_pool": _selected_pool,
    "task_default_queue": "bt",
    "task_default_exchange": "bt",
    "task_default_routing_key": "bt",
}
if _selected_pool == "solo":
    _config_update["worker_concurrency"] = int(BT_CELERY_WORKER_CONCURRENCY)
celery.conf.update(_config_update)

BT_TASK_NAMESPACE = "bt"


def init_celery(app) -> None:
    config_payload = dict(app.config)
    legacy_broker = config_payload.pop("CELERY_BROKER_URL", None)
    legacy_backend = config_payload.pop("CELERY_RESULT_BACKEND", None)
    if legacy_broker and not config_payload.get("broker_url"):
        config_payload["broker_url"] = legacy_broker
    if legacy_backend and not config_payload.get("result_backend"):
        config_payload["result_backend"] = legacy_backend

    celery.conf.update(config_payload)
    celery.conf.worker_pool = _selected_pool
    if _selected_pool == "solo":
        celery.conf.worker_concurrency = int(BT_CELERY_WORKER_CONCURRENCY)


beat_schedule = dict(getattr(celery.conf, "beat_schedule", {}) or {})
beat_schedule["campaigns-dispatch-due-communications"] = {
    "task": "bt.campaigns.dispatch_due_communications",
    "schedule": float(BT_CAMPAIGN_AUTOMATION_POLL_SECONDS),
    "options": {"queue": "bt"},
}
beat_schedule["campaigns-advance-lifecycle"] = {
    "task": "bt.campaigns.advance_lifecycle",
    "schedule": float(BT_CAMPAIGN_LIFECYCLE_POLL_SECONDS),
    "options": {"queue": "bt"},
}
beat_schedule["campaigns-evaluate-gift-reminders"] = {
    "task": "bt.campaigns.evaluate_gift_reminders",
    "schedule": float(BT_CAMPAIGN_AUTOMATION_POLL_SECONDS),
    "options": {"queue": "bt"},
}
celery.conf.beat_schedule = beat_schedule

__all__ = ["BT_TASK_NAMESPACE", "celery", "init_celery"]
