from __future__ import annotations

from datetime import UTC, datetime

from celery.exceptions import CeleryError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.celery import celery
from app.features.admin.llm_service import AdminLlmService
from app.features.campaigns.runtime_health import campaign_worker_is_healthy


class AdminHealthService:
    def __init__(self, llm_service: AdminLlmService | None = None) -> None:
        self._llm_service = llm_service or AdminLlmService()

    def get_health(self, db: Session) -> dict[str, object]:
        checks = {
            "database": self._check_database(db),
            "celery": self._check_celery(),
            "llm": self._llm_service.health(db),
        }

        statuses = [str(item.get("status") or "error") for item in checks.values()]
        if all(status == "ok" for status in statuses):
            overall = "healthy"
        elif any(status == "ok" for status in statuses):
            overall = "degraded"
        else:
            overall = "unhealthy"

        return {
            "overall": overall,
            "checked_at": datetime.now(UTC).isoformat(),
            "checks": checks,
        }

    @staticmethod
    def _check_database(db: Session) -> dict[str, object]:
        start = datetime.now(UTC)
        try:
            db.execute(text("SELECT 1"))
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            return {"status": "ok", "latency_ms": latency_ms, "message": "Database connection healthy."}
        except SQLAlchemyError as exc:
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            return {"status": "error", "latency_ms": latency_ms, "message": str(exc)}

    @staticmethod
    def _check_celery() -> dict[str, object]:
        worker_heartbeat = campaign_worker_is_healthy()
        try:
            inspect = celery.control.inspect(timeout=1.5)
            ping = inspect.ping() or {}
            worker_names = sorted(ping.keys())
            if worker_names or worker_heartbeat:
                return {
                    "status": "ok",
                    "workers": worker_names,
                    "worker_heartbeat": worker_heartbeat,
                    "message": "Celery worker responded.",
                }
            return {
                "status": "degraded",
                "workers": [],
                "worker_heartbeat": worker_heartbeat,
                "message": "Celery broker reachable but no worker responded.",
            }
        except CeleryError as exc:
            return {
                "status": "error",
                "workers": [],
                "worker_heartbeat": worker_heartbeat,
                "message": str(exc),
            }
