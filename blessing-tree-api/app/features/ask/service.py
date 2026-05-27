from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.ask.classifier import classify_prompt
from app.features.ask.entity_extractor import entities_from_llm_payload, merge_entities
from app.features.ask.help_catalog import HELP_TOPICS
from app.features.ask.llm_entity_extractor import AskLlmEntityExtractor
from app.features.ask.navigation_catalog import NAVIGATION_TARGETS, build_route
from app.features.ask.report_catalog import REPORT_METRICS
from app.features.ask.report_executors import AskReportExecutor
from app.features.ask.schemas import AskAction, Classification
from app.features.ask.serializers import serialize_action, serialize_entities
from app.features.campaigns.service import CampaignService
from app.features.rbac.services.authorization_service import AuthorizationService


class AskBlessingTreeService:
    def __init__(
        self,
        *,
        authorization: AuthorizationService | None = None,
        campaign_service: CampaignService | None = None,
        report_executor: AskReportExecutor | None = None,
        llm_extractor: AskLlmEntityExtractor | None = None,
    ) -> None:
        self.authorization = authorization or AuthorizationService()
        self.campaigns = campaign_service or CampaignService()
        self.report_executor = report_executor or AskReportExecutor()
        self.llm_extractor = llm_extractor or AskLlmEntityExtractor()

    def ask(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        prompt: str,
        include_debug: bool = False,
    ) -> dict[str, Any]:
        cleaned_prompt = (prompt or "").strip()
        if not cleaned_prompt:
            raise ServiceError("Prompt is required", status_code=400, details={"field": "prompt"})

        campaign = self.campaigns.get_campaign(db, str(campaign_id))
        classification = classify_prompt(cleaned_prompt)
        classification = self._merge_llm_classification(
            db,
            classification=classification,
            prompt=cleaned_prompt,
            campaign_name=campaign.name,
        )

        if classification.kind == "app_help" and classification.key:
            return self._help_response(db, campaign_id=campaign_id, user_id=user_id, classification=classification)
        if classification.kind == "navigation_result" and classification.key:
            return self._navigation_response(db, campaign_id=campaign_id, user_id=user_id, classification=classification)
        if classification.kind == "report_result" and classification.key:
            return self._report_response(
                db,
                campaign_id=campaign_id,
                user_id=user_id,
                classification=classification,
                include_debug=include_debug,
            )
        return self._clarification_response(classification)

    def _merge_llm_classification(
        self,
        db: Session,
        *,
        classification: Classification,
        prompt: str,
        campaign_name: str | None,
    ) -> Classification:
        payload = self.llm_extractor.extract(db, prompt=prompt, campaign_name=campaign_name)
        if not payload:
            return classification

        kind = _valid_kind(payload.get("kind"))
        key = _valid_catalog_key(kind, payload.get("catalog_key"))
        confidence = _valid_confidence(payload.get("confidence"))
        if kind is None or confidence < 0.7:
            return classification

        llm_entities = entities_from_llm_payload(payload)
        merged_entities = merge_entities(classification.entities, llm_entities)

        if classification.kind == "clarification" or confidence > classification.confidence:
            if key is not None:
                return Classification(
                    kind=kind,
                    key=key,
                    confidence=confidence,
                    entities=merged_entities,
                    alternates=classification.alternates,
                    warnings=merged_entities.warnings,
                    source="llm",
                )

        classification.entities = merged_entities
        classification.warnings = [*classification.warnings, *merged_entities.warnings]
        return classification

    def _help_response(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        classification: Classification,
    ) -> dict[str, Any]:
        topic = next((item for item in HELP_TOPICS if item.key == classification.key), None)
        if topic is None:
            return self._clarification_response(classification)
        actions = self._allowed_actions(db, campaign_id=campaign_id, user_id=user_id, actions=list(topic.actions))
        return {
            "kind": "app_help",
            "answer": topic.answer,
            "confidence": classification.confidence,
            "title": topic.title,
            "steps": list(topic.steps),
            "actions": [serialize_action(action, campaign_id=str(campaign_id)) for action in actions],
            "interpreted_as": serialize_entities(classification.entities),
            "warnings": classification.warnings,
            "suggestions": list(topic.related_prompts or classification.alternates),
        }

    def _navigation_response(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        classification: Classification,
    ) -> dict[str, Any]:
        target = next((item for item in NAVIGATION_TARGETS if item.key == classification.key), None)
        if target is None:
            return self._clarification_response(classification)
        action = AskAction(
            label=f"Open {target.title}",
            route_name=target.route_name,
            required_capability=target.required_capability,
        )
        allowed = self._allowed_actions(db, campaign_id=campaign_id, user_id=user_id, actions=[action])
        if not allowed:
            raise ServiceError("Forbidden", status_code=403, details={"code": "missing_campaign_capability"})
        route = build_route(target.route_name, str(campaign_id))
        return {
            "kind": "navigation_result",
            "answer": f"Open {target.title} from here.",
            "confidence": classification.confidence,
            "title": target.title,
            "actions": [{"type": "route", "label": f"Open {target.title}", "route": route, "prompt": None, "required_capability": target.required_capability}],
            "interpreted_as": serialize_entities(classification.entities),
            "warnings": classification.warnings,
            "suggestions": classification.alternates,
        }

    def _report_response(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        classification: Classification,
        include_debug: bool,
    ) -> dict[str, Any]:
        metric = next((item for item in REPORT_METRICS if item.metric_key == classification.key), None)
        if metric is None:
            return self._clarification_response(classification)
        self._require_capability(db, campaign_id=campaign_id, user_id=user_id, capability=metric.required_capability)
        intent = classification.entities.intent if classification.entities.intent in metric.intents else metric.intents[0]
        report = self.report_executor.execute(
            db,
            metric_key=metric.metric_key,
            campaign_id=campaign_id,
            filters=classification.entities.filters,
            intent=intent,
        )
        summary = report.get("summary") or {}
        answer = f"{summary.get('value', 0)} {str(summary.get('label') or metric.title).lower()}."
        actions = self._allowed_actions(
            db,
            campaign_id=campaign_id,
            user_id=user_id,
            actions=[
                AskAction(
                    label="Open Gift Status",
                    route_name="campaign_gifts_reports",
                    required_capability="campaign.reports.view",
                ),
                AskAction(
                    label="Open People Reports",
                    route_name="campaign_people_reports",
                    required_capability="campaign.reports.view",
                ),
            ],
        )
        response = {
            "kind": "report_result",
            "answer": answer,
            "confidence": classification.confidence,
            "title": metric.title,
            "actions": [serialize_action(action, campaign_id=str(campaign_id)) for action in actions],
            "report": report,
            "interpreted_as": serialize_entities(classification.entities, subject=metric.subject),
            "warnings": classification.warnings,
            "suggestions": classification.alternates,
        }
        if include_debug:
            response["debug"] = {"source": classification.source}
        return response

    @staticmethod
    def _clarification_response(classification: Classification) -> dict[str, Any]:
        suggestions = classification.alternates or [
            "How do I add a sponsor?",
            "Where is the Gift Status report?",
            "Show recipients still needing sponsors.",
        ]
        return {
            "kind": "clarification",
            "answer": "I am not sure which Blessing Tree task or report you need.",
            "confidence": classification.confidence,
            "actions": [
                {"type": "prompt", "label": suggestion, "route": None, "prompt": suggestion, "required_capability": None}
                for suggestion in suggestions[:4]
            ],
            "interpreted_as": serialize_entities(classification.entities),
            "warnings": classification.warnings,
            "suggestions": suggestions[:4],
        }

    def _allowed_actions(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        actions: list[AskAction],
    ) -> list[AskAction]:
        allowed: list[AskAction] = []
        for action in actions:
            capability = action.required_capability
            if capability is None or self.authorization.user_has_campaign_capability(db, user_id, campaign_id, capability):
                allowed.append(action)
        return allowed

    def _require_capability(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        capability: str,
    ) -> None:
        if not self.authorization.user_has_campaign_capability(db, user_id, campaign_id, capability):
            raise ServiceError(
                "Forbidden",
                status_code=403,
                details={"code": "missing_campaign_capability", "campaign_id": str(campaign_id), "capability": capability},
            )


def _valid_kind(value: object) -> str | None:
    if value in {"app_help", "navigation_result", "report_result", "clarification"}:
        return str(value)
    return None


def _valid_catalog_key(kind: str | None, value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    key = value.strip()
    if kind == "app_help" and any(item.key == key for item in HELP_TOPICS):
        return key
    if kind == "navigation_result" and any(item.key == key for item in NAVIGATION_TARGETS):
        return key
    if kind == "report_result" and any(item.metric_key == key for item in REPORT_METRICS):
        return key
    return None


def _valid_confidence(value: object) -> float:
    try:
        return max(0.0, min(float(value), 1.0))
    except (TypeError, ValueError):
        return 0.0
