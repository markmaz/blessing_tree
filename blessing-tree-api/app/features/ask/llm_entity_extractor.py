from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.features.admin.llm_runtime_service import AdminLlmRuntimeService, LlmRuntimeUnavailableError
from app.features.ask.help_catalog import HELP_TOPICS
from app.features.ask.navigation_catalog import NAVIGATION_TARGETS
from app.features.ask.report_catalog import REPORT_METRICS


class AskLlmEntityExtractor:
    def __init__(self, runtime: AdminLlmRuntimeService | None = None) -> None:
        self.runtime = runtime or AdminLlmRuntimeService()

    def extract(self, db: Session, *, prompt: str, campaign_name: str | None = None) -> dict[str, Any] | None:
        system_prompt = (
            "You extract structured intent and entities for Blessing Tree. "
            "Return JSON only. Do not return SQL, table names, or free-form actions. "
            "Choose only keys from the allowed catalogs. If uncertain, return kind clarification."
        )
        user_payload = {
            "prompt": prompt,
            "campaign": {"name": campaign_name},
            "allowed_kinds": ["app_help", "navigation_result", "report_result", "clarification"],
            "allowed_help_keys": [item.key for item in HELP_TOPICS],
            "allowed_navigation_keys": [item.key for item in NAVIGATION_TARGETS],
            "allowed_report_metric_keys": [item.metric_key for item in REPORT_METRICS],
            "allowed_filters": {
                "age_min": "integer",
                "age_max": "integer",
                "gender": ["F", "M", "X", "U"],
                "status": [
                    "OPEN",
                    "RESERVED",
                    "COMMITTED",
                    "RECEIVED",
                    "WRAPPED",
                    "TAGGED",
                    "READY_FOR_DISTRIBUTION",
                    "DISTRIBUTED",
                    "PICKED_UP",
                    "EXCEPTION",
                    "CANCELLED",
                ],
                "category": "short string",
            },
            "required_response_shape": {
                "kind": "app_help | navigation_result | report_result | clarification",
                "catalog_key": "one allowed key or null",
                "intent": "count | list | navigate | help",
                "entities": {},
                "confidence": "0.0 to 1.0",
                "reason": "brief explanation",
            },
        }
        try:
            return self.runtime.draft_json(
                db,
                system_prompt=system_prompt,
                user_prompt=json.dumps(user_payload, separators=(",", ":")),
            )
        except LlmRuntimeUnavailableError:
            return None
