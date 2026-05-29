from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.ask.classifier import classify_prompt
from app.features.ask.entity_extractor import entities_from_llm_payload, merge_entities
from app.features.ask.help_catalog import HELP_TOPICS
from app.features.ask.knowledge_base import GUIDE_DOWNLOAD_ROUTE, search_knowledge_base
from app.features.ask.llm_entity_extractor import AskLlmEntityExtractor
from app.features.ask.navigation_catalog import NAVIGATION_TARGETS, build_route
from app.features.ask.report_catalog import REPORT_METRICS
from app.features.ask.report_executors import AskReportExecutor
from app.features.ask.schemas import AskAction, Classification, KnowledgeArticle
from app.features.ask.serializers import serialize_action, serialize_entities
from app.features.campaigns.service import CampaignService
from app.features.rbac.services.authorization_service import AuthorizationService
from app.models.ask_prompt_log import AskPromptLog


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
        knowledge_match = search_knowledge_base(cleaned_prompt)

        if knowledge_match and _should_use_knowledge_match(cleaned_prompt, classification, knowledge_match[1]):
            response = self._knowledge_response(
                db,
                campaign_id=campaign_id,
                user_id=user_id,
                classification=classification,
                article=knowledge_match[0],
                score=knowledge_match[1],
            )
        elif classification.kind == "app_help" and classification.key:
            response = self._help_response(db, campaign_id=campaign_id, user_id=user_id, classification=classification)
        elif classification.kind == "navigation_result" and classification.key:
            response = self._navigation_response(db, campaign_id=campaign_id, user_id=user_id, classification=classification)
        elif classification.kind == "report_result" and classification.key:
            response = self._report_response(
                db,
                campaign_id=campaign_id,
                user_id=user_id,
                classification=classification,
                include_debug=include_debug,
            )
        else:
            response = self._clarification_response(classification)
        self._record_prompt_log(
            db,
            campaign_id=campaign_id,
            user_id=user_id,
            prompt=cleaned_prompt,
            classification=classification,
            response=response,
        )
        return response

    def _knowledge_response(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        classification: Classification,
        article: KnowledgeArticle,
        score: float,
    ) -> dict[str, Any]:
        actions: list[AskAction] = [
            AskAction(
                label="Download User Guide",
                type="external",
                route=GUIDE_DOWNLOAD_ROUTE,
            )
        ]
        if article.route_name:
            actions.insert(
                0,
                AskAction(
                    label=f"Open {article.title}",
                    route_name=article.route_name,
                    required_capability=article.required_capability,
                ),
            )
        allowed_actions = self._allowed_actions(db, campaign_id=campaign_id, user_id=user_id, actions=actions)
        suggestions = [
            "How do I add a sponsor?",
            "How do I receive and distribute gifts?",
            "Where is the Gift Status report?",
        ]
        return {
            "kind": "knowledge_result",
            "answer": article.content,
            "confidence": max(score, classification.confidence),
            "title": article.title,
            "steps": list(article.steps),
            "actions": [serialize_action(action, campaign_id=str(campaign_id)) for action in allowed_actions],
            "interpreted_as": serialize_entities(classification.entities),
            "warnings": classification.warnings,
            "suggestions": suggestions,
            "sources": [{"title": article.section, "document": "Blessing Tree User Guide"}],
        }

    def record_feedback(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        prompt_log_id: uuid.UUID,
        rating: str,
        comment: str | None = None,
    ) -> AskPromptLog:
        normalized_rating = str(rating or "").strip().upper()
        if normalized_rating not in {"POSITIVE", "NEGATIVE"}:
            raise ServiceError("rating must be POSITIVE or NEGATIVE", status_code=400, details={"field": "rating"})
        log = (
            db.query(AskPromptLog)
            .filter(AskPromptLog.id == prompt_log_id, AskPromptLog.campaign_id == campaign_id)
            .one_or_none()
        )
        if log is None:
            raise ServiceError("Ask prompt log not found", status_code=404)
        log.feedback_rating = normalized_rating
        log.feedback_comment = (comment or "").strip()[:1000] or None
        log.feedback_at = datetime.utcnow()
        db.commit()
        db.refresh(log)
        return log

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
            user_id=user_id,
        )
        summary = report.get("summary") or {}
        answer = f"{summary.get('value', 0)} {str(summary.get('label') or metric.title).lower()}."
        actions = self._allowed_actions(
            db,
            campaign_id=campaign_id,
            user_id=user_id,
            actions=_report_actions(metric.metric_key, metric.subject),
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

    @staticmethod
    def _record_prompt_log(
        db: Session,
        *,
        campaign_id: uuid.UUID,
        user_id: uuid.UUID | None,
        prompt: str,
        classification: Classification,
        response: dict[str, Any],
    ) -> None:
        summary = _response_log_summary(response)
        log = AskPromptLog(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            user_id=user_id,
            prompt=prompt,
            result_kind=response.get("kind") or classification.kind,
            result_key=classification.key,
            confidence=float(response.get("confidence") or classification.confidence or 0),
            source=classification.source,
            response_summary_json=summary,
        )
        db.add(log)
        db.commit()
        response["prompt_log_id"] = str(log.id)


def _valid_kind(value: object) -> str | None:
    if value in {"app_help", "navigation_result", "report_result", "knowledge_result", "clarification"}:
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


def _response_log_summary(response: dict[str, Any]) -> dict[str, Any]:
    report = response.get("report") if isinstance(response.get("report"), dict) else None
    summary = report.get("summary") if isinstance(report, dict) and isinstance(report.get("summary"), dict) else None
    return {
        "title": response.get("title"),
        "answer": response.get("answer"),
        "kind": response.get("kind"),
        "report_metric_key": report.get("metric_key") if isinstance(report, dict) else None,
        "report_summary": summary,
        "warnings": list(response.get("warnings") or []),
        "sources": list(response.get("sources") or []),
        "actions": [
            {"label": action.get("label"), "route": action.get("route"), "prompt": action.get("prompt")}
            for action in response.get("actions") or []
            if isinstance(action, dict)
        ],
    }


def _should_use_knowledge_match(prompt: str, classification: Classification, knowledge_score: float) -> bool:
    if knowledge_score < 0.48:
        return False
    normalized_prompt = prompt.lower()
    explicitly_guide = any(word in normalized_prompt for word in ("guide", "manual", "documentation", "document", "pdf"))
    if explicitly_guide and knowledge_score >= 0.55:
        return True
    if classification.kind == "report_result":
        return False
    if classification.kind == "clarification":
        return True
    if classification.kind == "navigation_result" and knowledge_score >= 0.62 and classification.confidence < 0.8:
        return True
    if classification.kind == "app_help" and knowledge_score > classification.confidence + 0.12:
        return True
    return False


def _report_actions(metric_key: str, subject: str) -> list[AskAction]:
    if metric_key == "readiness_blockers":
        return [
            AskAction(
                label="Open Campaign Studio",
                route_name="campaign_studio",
                required_capability="campaign.manage",
            )
        ]
    if subject == "dashboard":
        return [
            AskAction(
                label="Open Dashboard",
                route_name="dashboard",
                required_capability="campaign.view",
            )
        ]
    if subject == "sponsors":
        return [
            AskAction(
                label="Open Sponsor Reports",
                route_name="campaign_sponsors_reports",
                required_capability="campaign.reports.view",
            ),
            AskAction(
                label="Open Sponsors",
                route_name="campaign_sponsors_directory",
                required_capability="campaign.sponsors.view",
            ),
        ]
    if subject == "recipients":
        return [
            AskAction(
                label="Open People Reports",
                route_name="campaign_people_reports",
                required_capability="campaign.reports.view",
            ),
            AskAction(
                label="Open People",
                route_name="campaign_people_directory",
                required_capability="campaign.recipients.view",
            ),
        ]
    if subject == "donations":
        return [
            AskAction(
                label="Open Gift Pool",
                route_name="campaign_gifts_pool",
                required_capability="campaign.gifts.pool.manage",
            )
        ]
    return [
        AskAction(
            label="Open Gift Status",
            route_name="campaign_gifts_reports",
            required_capability="campaign.reports.view",
        )
    ]
