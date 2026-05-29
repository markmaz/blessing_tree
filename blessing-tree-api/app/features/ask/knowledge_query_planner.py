from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.features.ask.entity_extractor import normalize_prompt

if TYPE_CHECKING:
    from app.features.admin.llm_runtime_service import AdminLlmRuntimeService


@dataclass(frozen=True)
class AskKnowledgeQueryPlan:
    intent: str
    retrieval_query: str
    field_name: str | None = None
    screen: str | None = None
    confidence: float = 0.0
    source: str = "deterministic"


@dataclass(frozen=True)
class AskRequestContext:
    screen: str | None = None
    field_name: str | None = None
    field_label: str | None = None
    route: str | None = None
    current_value: str | None = None


class AskKnowledgeQueryPlanner:
    def __init__(self, runtime: AdminLlmRuntimeService | None = None) -> None:
        if runtime is None:
            from app.features.admin.llm_runtime_service import AdminLlmRuntimeService

            runtime = AdminLlmRuntimeService()
        self.runtime = runtime

    def plan(
        self,
        db: Session,
        *,
        prompt: str,
        campaign_name: str | None = None,
        context: AskRequestContext | None = None,
    ) -> AskKnowledgeQueryPlan:
        context_plan = _context_plan(prompt, context)
        if context_plan is not None:
            return context_plan
        deterministic = _deterministic_plan(prompt)
        payload = self._llm_plan_payload(db, prompt=prompt, campaign_name=campaign_name, context=context)
        if payload is None:
            return deterministic

        intent = _valid_intent(payload.get("intent"))
        confidence = _valid_confidence(payload.get("confidence"))
        if intent is None or confidence < 0.65:
            return deterministic

        field_name = _clean_optional_text(payload.get("field_name"))
        screen = _clean_optional_text(payload.get("screen"))
        retrieval_query = _clean_optional_text(payload.get("retrieval_query")) or field_name or screen or prompt
        if deterministic.intent == "field_help" and deterministic.field_name and not field_name:
            field_name = deterministic.field_name
            retrieval_query = deterministic.retrieval_query

        return AskKnowledgeQueryPlan(
            intent=intent,
            field_name=field_name,
            screen=screen,
            retrieval_query=retrieval_query,
            confidence=confidence,
            source="llm",
        )

    def _llm_plan_payload(
        self,
        db: Session,
        *,
        prompt: str,
        campaign_name: str | None,
        context: AskRequestContext | None,
    ) -> dict[str, Any] | None:
        system_prompt = (
            "You plan retrieval for Blessing Tree app-help questions. Return JSON only. "
            "Extract the user's intent and the clean field or screen name when present. "
            "Do not answer the question."
        )
        user_payload = {
            "prompt": prompt,
            "campaign": {"name": campaign_name},
            "context": {
                "screen": context.screen,
                "field_name": context.field_name,
                "field_label": context.field_label,
                "route": context.route,
            }
            if context
            else None,
            "allowed_intents": [
                "field_help",
                "workflow_help",
                "navigation_help",
                "report_question",
                "general_help",
                "unknown",
            ],
            "required_response_shape": {
                "intent": "one allowed intent",
                "field_name": "clean field label or null",
                "screen": "screen/workspace name or null",
                "retrieval_query": "short search query for app documentation",
                "confidence": "0.0 to 1.0",
                "reason": "brief explanation",
            },
            "examples": [
                {
                    "prompt": "What should I put in the campaign purpose?",
                    "intent": "field_help",
                    "field_name": "campaign purpose",
                    "screen": "campaign settings",
                    "retrieval_query": "campaign purpose field",
                },
                {
                    "prompt": "What goes in people served?",
                    "intent": "field_help",
                    "field_name": "people served",
                    "screen": "organization types",
                    "retrieval_query": "people served field",
                },
                {
                    "prompt": "How do I add a sponsor?",
                    "intent": "workflow_help",
                    "field_name": None,
                    "screen": "sponsors",
                    "retrieval_query": "add sponsor workflow",
                },
            ],
        }
        try:
            return self.runtime.draft_json(
                db,
                system_prompt=system_prompt,
                user_prompt=json.dumps(user_payload, separators=(",", ":")),
            )
        except RuntimeError:
            return None


FIELD_HELP_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"what\s+should\s+i\s+put\s+in\s+(?:the\s+)?(?P<field>.+?)(?:\s+field)?\??$"),
    re.compile(r"what\s+do\s+i\s+put\s+in\s+(?:the\s+)?(?P<field>.+?)(?:\s+field)?\??$"),
    re.compile(r"what\s+goes\s+in\s+(?:the\s+)?(?P<field>.+?)(?:\s+field)?\??$"),
    re.compile(r"what\s+should\s+go\s+in\s+(?:the\s+)?(?P<field>.+?)(?:\s+field)?\??$"),
    re.compile(r"what\s+does\s+(?:the\s+)?(?P<field>.+?)(?:\s+field)?\s+mean\??$"),
    re.compile(r"explain\s+(?:the\s+)?(?P<field>.+?)(?:\s+field)?\??$"),
    re.compile(r"help\s+(?:me\s+)?(?:with|on)\s+(?:the\s+)?(?P<field>.+?)(?:\s+field)?\??$"),
)


def request_context_from_payload(payload: object) -> AskRequestContext | None:
    if not isinstance(payload, dict):
        return None
    context = AskRequestContext(
        screen=_clean_optional_text(payload.get("screen")),
        field_name=_clean_optional_text(payload.get("field_name")),
        field_label=_clean_optional_text(payload.get("field_label")),
        route=_clean_optional_text(payload.get("route")),
        current_value=_clean_optional_text(payload.get("current_value")),
    )
    if any((context.screen, context.field_name, context.field_label, context.route, context.current_value)):
        return context
    return None


def _context_plan(prompt: str, context: AskRequestContext | None) -> AskKnowledgeQueryPlan | None:
    if context is None:
        return None
    field_name = context.field_name or context.field_label
    if not field_name:
        return None
    return AskKnowledgeQueryPlan(
        intent="field_help",
        field_name=field_name,
        screen=context.screen,
        retrieval_query=f"{field_name} field {context.screen or ''}".strip(),
        confidence=0.98,
        source="context",
    )


def _deterministic_plan(prompt: str) -> AskKnowledgeQueryPlan:
    text = normalize_prompt(prompt)
    for pattern in FIELD_HELP_PATTERNS:
        match = pattern.search(text)
        if match:
            field_name = match.group("field").strip()
            return AskKnowledgeQueryPlan(
                intent="field_help",
                field_name=field_name,
                retrieval_query=f"{field_name} field",
                confidence=0.82,
            )
    if any(phrase in text for phrase in ("where is", "where do i", "open ", "take me to", "go to")):
        return AskKnowledgeQueryPlan(intent="navigation_help", retrieval_query=prompt, confidence=0.55)
    if any(phrase in text for phrase in ("how do i", "how to", "help me")):
        return AskKnowledgeQueryPlan(intent="workflow_help", retrieval_query=prompt, confidence=0.55)
    return AskKnowledgeQueryPlan(intent="unknown", retrieval_query=prompt, confidence=0.0)


def _valid_intent(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    if normalized in {"field_help", "workflow_help", "navigation_help", "report_question", "general_help", "unknown"}:
        return normalized
    return None


def _valid_confidence(value: object) -> float:
    try:
        return max(0.0, min(float(value), 1.0))
    except (TypeError, ValueError):
        return 0.0


def _clean_optional_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None
