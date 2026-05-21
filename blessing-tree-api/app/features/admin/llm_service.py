from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import requests
from requests import RequestException
from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.admin.validation import require_text, validate_provider
from app.models.admin_llm_configuration import AdminLlmConfiguration
from app.utils.secret_encryption import decrypt_secret, encrypt_secret


class AdminLlmService:
    def get_configuration(self, db: Session) -> AdminLlmConfiguration | None:
        return (
            db.query(AdminLlmConfiguration)
            .order_by(AdminLlmConfiguration.updated_at.desc())
            .first()
        )

    def save_configuration(self, db: Session, payload: dict[str, Any]) -> AdminLlmConfiguration:
        config = self.get_configuration(db)
        if config is None:
            config = AdminLlmConfiguration()
            db.add(config)

        config.provider = validate_provider(payload.get("provider") or "OPENAI_COMPATIBLE")
        config.label = require_text(payload.get("label") or "Primary LLM", "label", max_length=120)
        config.base_url = require_text(payload.get("base_url"), "base_url", max_length=512).rstrip("/")
        config.model = require_text(payload.get("model"), "model", max_length=255)
        if "api_key" in payload:
            config.api_key_encrypted = encrypt_secret(payload.get("api_key"))
        if "is_enabled" in payload:
            config.is_enabled = bool(payload.get("is_enabled"))
        db.commit()
        db.refresh(config)
        return config

    def test_configuration(self, db: Session) -> dict[str, object]:
        config = self.get_configuration(db)
        if config is None:
            raise ServiceError("LLM is not configured", status_code=400)
        result = self._probe_config(config)
        config.last_tested_at = datetime.now(UTC).replace(tzinfo=None)
        config.last_test_status = str(result["status"])
        config.last_test_message = str(result.get("message") or "")
        db.commit()
        return result

    def health(self, db: Session) -> dict[str, object]:
        config = self.get_configuration(db)
        if config is None:
            return {
                "status": "degraded",
                "configured": False,
                "message": "LLM is not configured.",
            }
        if not config.is_enabled:
            return {
                "status": "degraded",
                "configured": True,
                "message": "LLM is configured but disabled.",
                "model": config.model,
                "provider": config.provider,
            }
        return self._probe_config(config)

    @staticmethod
    def _probe_config(config: AdminLlmConfiguration) -> dict[str, object]:
        headers: dict[str, str] = {}
        api_key = decrypt_secret(config.api_key_encrypted)
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        url = f"{config.base_url.rstrip('/')}/models"
        start = datetime.now(UTC)
        try:
            response = requests.get(url, headers=headers, timeout=10)
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            response.raise_for_status()
            payload = response.json()
            models = payload.get("data") if isinstance(payload, dict) else None
            return {
                "status": "ok",
                "configured": True,
                "provider": config.provider,
                "model": config.model,
                "latency_ms": latency_ms,
                "message": "LLM connection succeeded.",
                "available_models": [
                    str(item.get("id") or "").strip()
                    for item in models
                    if isinstance(item, dict) and str(item.get("id") or "").strip()
                ],
            }
        except (RequestException, ValueError) as exc:
            latency_ms = int((datetime.now(UTC) - start).total_seconds() * 1000)
            return {
                "status": "error",
                "configured": True,
                "provider": config.provider,
                "model": config.model,
                "latency_ms": latency_ms,
                "message": str(exc),
            }
