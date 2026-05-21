from __future__ import annotations

from datetime import UTC, datetime

from app.celery import BT_TASK_NAMESPACE, celery
from app.db import SessionLocal
from app.factory import create_app
from app.features.campaigns.automation_dispatch_service import (
    CampaignAutomationDispatchService,
)
from app.features.campaigns.automation_lifecycle_service import (
    CampaignAutomationLifecycleService,
)
from app.features.campaigns.automation_repository import CampaignAutomationRepository
from app.features.campaigns.runtime_health import record_campaign_worker_heartbeat


@celery.task(name=f"{BT_TASK_NAMESPACE}.campaigns.dispatch_due_communications")
def dispatch_due_communications_task() -> dict[str, object]:
    return _run_task(
        task_name="dispatch_due_communications",
        action=_dispatch_due_communications,
    )


@celery.task(name=f"{BT_TASK_NAMESPACE}.campaigns.advance_lifecycle")
def advance_lifecycle_task() -> dict[str, object]:
    return _run_task(
        task_name="advance_lifecycle",
        action=_advance_lifecycle,
    )


def _run_task(*, task_name: str, action):
    app = create_app()
    with app.app_context():
        record_campaign_worker_heartbeat(task_name=task_name)
        return action()


def _dispatch_due_communications() -> dict[str, object]:
    repository = CampaignAutomationRepository()
    service = CampaignAutomationDispatchService(repository=repository)
    now = datetime.now(UTC).replace(tzinfo=None)

    with SessionLocal() as db:
        schedule_ids = repository.list_due_schedule_ids(db, now=now)

    results: list[dict[str, object]] = []
    for schedule_id in schedule_ids:
        with SessionLocal() as db:
            results.append(service.dispatch_schedule(db, schedule_id=schedule_id))

    return {
        "task": "dispatch_due_communications",
        "processed": len(results),
        "results": results,
    }


def _advance_lifecycle() -> dict[str, object]:
    repository = CampaignAutomationRepository()
    service = CampaignAutomationLifecycleService(repository=repository)
    today = datetime.now(UTC).date()

    with SessionLocal() as db:
        activation_ids = repository.list_campaign_ids_due_for_activation(db, today=today)
        closure_ids = repository.list_campaign_ids_due_for_closure(db, today=today)

    activation_results: list[dict[str, object]] = []
    for campaign_id in activation_ids:
        with SessionLocal() as db:
            activation_results.append(service.activate_campaign(db, campaign_id=campaign_id))

    closure_results: list[dict[str, object]] = []
    for campaign_id in closure_ids:
        with SessionLocal() as db:
            closure_results.append(service.close_campaign(db, campaign_id=campaign_id))

    return {
        "task": "advance_lifecycle",
        "activated": activation_results,
        "closed": closure_results,
    }
