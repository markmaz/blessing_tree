from __future__ import annotations

import os
import shutil
from datetime import UTC, datetime

import requests
from celery.exceptions import CeleryError
from requests import RequestException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.celery import celery
from app.features.admin.llm_service import AdminLlmService
from app.features.admin.llm_runtime_service import LlmRuntimeUnavailableError
from app.features.ask.vector_retriever import AskVectorKnowledgeRetriever
from app.features.campaigns.runtime_health import campaign_worker_is_healthy
from app.features.gifts.semantic_search_service import GiftSemanticSearchService


class AdminHealthService:
    def __init__(
        self,
        llm_service: AdminLlmService | None = None,
        ask_vector_retriever: AskVectorKnowledgeRetriever | None = None,
        gift_semantic_service: GiftSemanticSearchService | None = None,
    ) -> None:
        self._llm_service = llm_service or AdminLlmService()
        self._ask_vector_retriever = ask_vector_retriever or AskVectorKnowledgeRetriever()
        self._gift_semantic_service = gift_semantic_service or GiftSemanticSearchService()

    def get_health(self, db: Session) -> dict[str, object]:
        checks = {
            "database": self._check_database(db),
            "celery": self._check_celery(),
            "llm": self._llm_service.health(db),
            "qdrant": self._check_qdrant(),
            "email": self._check_email(),
            "storage": self._check_storage(),
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

    def rebuild_qdrant_indexes(self, db: Session) -> dict[str, object]:
        start = datetime.now(UTC)
        try:
            ask_result = self._ask_vector_retriever.rebuild_index(db)
            gift_result = self._gift_semantic_service.rebuild_all_campaign_indexes(db)
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            return {
                "status": "ok",
                "latency_ms": latency_ms,
                "ask": ask_result,
                "gift_search": gift_result,
                "message": "Qdrant indexes generated.",
            }
        except RequestException:
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            qdrant_url = (os.getenv("QDRANT_URL") or "http://localhost:6333").strip().rstrip("/")
            return {
                "status": "error",
                "latency_ms": latency_ms,
                "ask": None,
                "gift_search": None,
                "message": (
                    f"Qdrant is not reachable at {qdrant_url}. Start the qdrant service or update QDRANT_URL, "
                    "then try Generate Index again."
                ),
            }
        except RuntimeError as exc:
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            is_embedding_error = isinstance(exc, LlmRuntimeUnavailableError)
            return {
                "status": "error",
                "latency_ms": latency_ms,
                "ask": None,
                "gift_search": None,
                "message": (
                    f"Unable to generate Qdrant indexes because embeddings are unavailable: {exc}"
                    if is_embedding_error
                    else str(exc) or "Unable to generate Qdrant indexes."
                ),
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

    @staticmethod
    def _check_qdrant() -> dict[str, object]:
        ask_enabled = _env_bool("BT_ASK_VECTOR_ENABLED", default=True)
        gift_enabled = _env_bool("BT_GIFT_VECTOR_ENABLED", default=True)
        qdrant_url = (os.getenv("QDRANT_URL") or "http://localhost:6333").strip().rstrip("/")
        qdrant_api_key = (os.getenv("QDRANT_API_KEY") or "").strip()
        ask_collection = (os.getenv("BT_ASK_KNOWLEDGE_COLLECTION") or "blessing_tree_ask_knowledge").strip()
        gift_collection = (os.getenv("BT_GIFT_VECTOR_COLLECTION") or "bt_gift_search_v1").strip()

        if not ask_enabled and not gift_enabled:
            return {
                "status": "degraded",
                "configured": False,
                "message": "Qdrant-backed search is disabled.",
            }
        start = datetime.now(UTC)
        try:
            headers = {"api-key": qdrant_api_key} if qdrant_api_key else None
            response = requests.get(
                f"{qdrant_url}/collections",
                headers=headers,
                timeout=float(os.getenv("QDRANT_TIMEOUT_S") or "30"),
            )
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            response.raise_for_status()
            collection_names = _collection_names(response.json())
            missing_collections = [
                name
                for enabled, name in ((ask_enabled, ask_collection), (gift_enabled, gift_collection))
                if enabled and name not in collection_names
            ]
            status = "degraded" if missing_collections else "ok"
            message = (
                f"Qdrant reachable, but collection(s) missing: {', '.join(missing_collections)}."
                if missing_collections
                else "Qdrant reachable."
            )
            return {
                "status": status,
                "configured": True,
                "latency_ms": latency_ms,
                "url": qdrant_url,
                "collections": sorted(collection_names),
                "expected_collections": [name for enabled, name in ((ask_enabled, ask_collection), (gift_enabled, gift_collection)) if enabled],
                "message": message,
            }
        except RequestException as exc:
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            return {
                "status": "error",
                "configured": True,
                "latency_ms": latency_ms,
                "url": qdrant_url,
                "message": f"Qdrant is not reachable at {qdrant_url}. Start the qdrant service or update QDRANT_URL.",
            }

    @staticmethod
    def _check_email() -> dict[str, object]:
        smtp_server = (os.getenv("SMTP_SERVER") or "").strip()
        default_sender = (os.getenv("DEFAULT_MAIL_SENDER") or "").strip()
        smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
        smtp_password = (os.getenv("SMTP_PASSWORD") or "").strip()
        smtp_port = (os.getenv("SMTP_PORT") or os.getenv("SMPT_PORT") or "").strip()
        missing = [
            label
            for label, value in (
                ("SMTP_SERVER", smtp_server),
                ("SMTP_PORT", smtp_port),
                ("DEFAULT_MAIL_SENDER", default_sender),
            )
            if not value
        ]
        auth_partial = bool(smtp_username) != bool(smtp_password)
        if missing or auth_partial:
            auth_message = " SMTP_USERNAME and SMTP_PASSWORD must be set together." if auth_partial else ""
            return {
                "status": "degraded",
                "configured": False,
                "provider": smtp_server or None,
                "message": f"Email is not fully configured. Missing: {', '.join(missing) or 'none'}.{auth_message}".strip(),
            }
        return {
            "status": "ok",
            "configured": True,
            "provider": smtp_server,
            "message": "Email configuration is present. Send a test email from Campaign Studio to verify delivery.",
        }

    @staticmethod
    def _check_storage() -> dict[str, object]:
        path = (os.getenv("BT_STORAGE_HEALTH_PATH") or "/").strip() or "/"
        try:
            usage = shutil.disk_usage(path)
        except OSError as exc:
            return {
                "status": "error",
                "path": path,
                "message": f"Unable to read disk usage for {path}: {exc}",
            }
        free_percent = round((usage.free / usage.total) * 100, 1) if usage.total else 0.0
        used_percent = round(100 - free_percent, 1)
        if free_percent < 10:
            status = "error"
            message = f"Disk free space is critically low at {free_percent}%."
        elif free_percent < 20:
            status = "degraded"
            message = f"Disk free space is low at {free_percent}%."
        else:
            status = "ok"
            message = f"Disk free space is healthy at {free_percent}%."
        return {
            "status": status,
            "path": path,
            "total_bytes": usage.total,
            "free_bytes": usage.free,
            "used_percent": used_percent,
            "free_percent": free_percent,
            "message": message,
        }


def _collection_names(payload: object) -> set[str]:
    result = payload.get("result") if isinstance(payload, dict) else None
    collections = result.get("collections") if isinstance(result, dict) else None
    if not isinstance(collections, list):
        return set()
    names: set[str] = set()
    for collection in collections:
        name = collection.get("name") if isinstance(collection, dict) else None
        if isinstance(name, str) and name:
            names.add(name)
    return names


def _env_bool(name: str, *, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
