from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from flask import g, has_request_context, request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.models.app_user import AppUser
from app.models.audit_event import AuditEvent
from app.models.campaign import Campaign


AUDIT_AREAS = (
    "admin",
    "campaigns",
    "people",
    "sponsors",
    "gifts",
    "communications",
    "reports",
    "ask",
    "templates",
)

AUDIT_ACTIONS = (
    "created",
    "updated",
    "deleted",
    "status_changed",
    "sent",
    "scheduled",
    "printed",
    "scanned",
    "activated",
    "deactivated",
)

SENSITIVE_FIELD_MARKERS = (
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "smtp_password",
    "refresh",
    "credential",
)


@dataclass(frozen=True)
class AuditChange:
    field: str
    label: str
    before: Any
    after: Any

    def to_dict(self) -> dict[str, Any]:
        return {
            "field": self.field,
            "label": self.label,
            "before": self.before,
            "after": self.after,
        }


def _coerce_uuid(value: str | uuid.UUID | None, *, field_name: str) -> uuid.UUID | None:
    if value is None or value == "":
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise ServiceError(f"Invalid {field_name}", status_code=400, details={field_name: str(value)}) from exc


def _truncate(value: str | None, max_length: int) -> str | None:
    if value is None:
        return None
    return value[:max_length]


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, uuid.UUID)):
        return str(value)
    return value


def _sanitize_change(change: AuditChange | dict[str, Any]) -> dict[str, Any]:
    payload = change.to_dict() if isinstance(change, AuditChange) else dict(change)
    field = str(payload.get("field") or "")
    lower_field = field.lower()
    if any(marker in lower_field for marker in SENSITIVE_FIELD_MARKERS):
        payload["before"] = "[redacted]"
        payload["after"] = "[redacted]"
    else:
        payload["before"] = _serialize_value(payload.get("before"))
        payload["after"] = _serialize_value(payload.get("after"))
    payload["field"] = field[:128]
    payload["label"] = str(payload.get("label") or field or "Field")[:160]
    return payload


def build_changes(
    *,
    before: object,
    after: object,
    field_map: dict[str, str],
) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    for field, label in field_map.items():
        before_value = getattr(before, field, None) if not isinstance(before, dict) else before.get(field)
        after_value = getattr(after, field, None) if not isinstance(after, dict) else after.get(field)
        if before_value == after_value:
            continue
        changes.append(
            _sanitize_change(
                AuditChange(
                    field=field,
                    label=label,
                    before=_serialize_value(before_value),
                    after=_serialize_value(after_value),
                )
            )
        )
    return changes


class AuditEventService:
    def record_event(
        self,
        db: Session,
        *,
        area: str,
        action: str,
        entity_type: str,
        summary: str,
        entity_id: str | uuid.UUID | None = None,
        entity_label: str | None = None,
        campaign_id: str | uuid.UUID | None = None,
        actor_user_id: str | uuid.UUID | None = None,
        changes: list[AuditChange | dict[str, Any]] | None = None,
        metadata: dict[str, Any] | None = None,
        occurred_at: datetime | None = None,
    ) -> AuditEvent:
        actor_id = _coerce_uuid(actor_user_id, field_name="actor_user_id")
        campaign_uuid = _coerce_uuid(campaign_id, field_name="campaign_id")
        entity_uuid = _coerce_uuid(entity_id, field_name="entity_id")
        actor = db.get(AppUser, actor_id) if actor_id else None
        request_context = self._request_context()

        event = AuditEvent(
            id=uuid.uuid4(),
            occurred_at=occurred_at or datetime.utcnow(),
            actor_user_id=actor_id,
            actor_display_name=actor.display_name if actor else request_context.get("actor_display_name"),
            actor_email=actor.email if actor else request_context.get("actor_email"),
            campaign_id=campaign_uuid,
            area=area[:64],
            action=action[:64],
            entity_type=entity_type[:96],
            entity_id=entity_uuid,
            entity_label=_truncate(entity_label, 255),
            summary=_truncate(summary, 500) or "Activity recorded.",
            change_set_json=[_sanitize_change(change) for change in changes] if changes else None,
            metadata_json=self._sanitize_metadata(metadata),
            correlation_id=_truncate(request_context.get("correlation_id"), 64),
            ip_address=_truncate(request_context.get("ip_address"), 255),
            user_agent=_truncate(request_context.get("user_agent"), 500),
        )
        db.add(event)
        db.flush()
        return event

    def list_events(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 25,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        actor_user_id: str | None = None,
        campaign_id: str | None = None,
        area: str | None = None,
        action: str | None = None,
        entity_type: str | None = None,
        search: str | None = None,
    ) -> dict[str, object]:
        page = min(max(page, 1), 10_000)
        page_size = min(max(page_size, 1), 100)
        query = db.query(AuditEvent, Campaign).outerjoin(Campaign, Campaign.id == AuditEvent.campaign_id)

        if date_from is not None:
            query = query.filter(AuditEvent.occurred_at >= date_from)
        if date_to is not None:
            query = query.filter(AuditEvent.occurred_at <= date_to)
        if actor_user_id:
            query = query.filter(AuditEvent.actor_user_id == _coerce_uuid(actor_user_id, field_name="actor_user_id"))
        if campaign_id:
            query = query.filter(AuditEvent.campaign_id == _coerce_uuid(campaign_id, field_name="campaign_id"))
        if area:
            query = query.filter(AuditEvent.area == area)
        if action:
            query = query.filter(AuditEvent.action == action)
        if entity_type:
            query = query.filter(AuditEvent.entity_type == entity_type)
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    AuditEvent.summary.ilike(pattern),
                    AuditEvent.entity_label.ilike(pattern),
                    AuditEvent.actor_display_name.ilike(pattern),
                    AuditEvent.actor_email.ilike(pattern),
                    Campaign.name.ilike(pattern),
                )
            )

        total = query.count()
        rows = (
            query.order_by(AuditEvent.occurred_at.desc(), AuditEvent.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return {
            "items": [self.serialize_list_item(event, campaign) for event, campaign in rows],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
            },
            "filters": {
                "areas": list(AUDIT_AREAS),
                "actions": list(AUDIT_ACTIONS),
            },
        }

    def get_event_detail(self, db: Session, event_id: str) -> dict[str, object]:
        event_uuid = _coerce_uuid(event_id, field_name="event_id")
        row = (
            db.query(AuditEvent, Campaign)
            .outerjoin(Campaign, Campaign.id == AuditEvent.campaign_id)
            .filter(AuditEvent.id == event_uuid)
            .one_or_none()
        )
        if row is None:
            raise ServiceError("Audit event not found", status_code=404)
        event, campaign = row
        return self.serialize_detail(event, campaign)

    def serialize_list_item(self, event: AuditEvent, campaign: Campaign | None) -> dict[str, object]:
        return {
            "id": str(event.id),
            "occurred_at": event.occurred_at.isoformat(),
            "actor": self._serialize_actor(event),
            "campaign": self._serialize_campaign(campaign),
            "area": event.area,
            "action": event.action,
            "entity_type": event.entity_type,
            "entity_id": str(event.entity_id) if event.entity_id else None,
            "entity_label": event.entity_label,
            "summary": event.summary,
            "change_count": len(event.change_set_json or []),
        }

    def serialize_detail(self, event: AuditEvent, campaign: Campaign | None) -> dict[str, object]:
        return {
            **self.serialize_list_item(event, campaign),
            "change_set": event.change_set_json or [],
            "metadata": event.metadata_json or {},
            "correlation_id": event.correlation_id,
            "ip_address": event.ip_address,
            "user_agent": event.user_agent,
            "created_at": event.created_at.isoformat(),
        }

    def _request_context(self) -> dict[str, str | None]:
        if not has_request_context():
            return {}
        return {
            "correlation_id": getattr(g, "correlation_id", None),
            "ip_address": request.headers.get("X-Forwarded-For", request.remote_addr),
            "user_agent": request.headers.get("User-Agent"),
            "actor_display_name": getattr(g, "user_display_name", None),
            "actor_email": None,
        }

    def _serialize_actor(self, event: AuditEvent) -> dict[str, object] | None:
        if not event.actor_user_id and not event.actor_display_name and not event.actor_email:
            return None
        return {
            "user_id": str(event.actor_user_id) if event.actor_user_id else None,
            "display_name": event.actor_display_name,
            "email": event.actor_email,
        }

    def _serialize_campaign(self, campaign: Campaign | None) -> dict[str, object] | None:
        if campaign is None:
            return None
        return {
            "id": str(campaign.id),
            "name": campaign.name,
        }

    def _sanitize_metadata(self, metadata: dict[str, Any] | None) -> dict[str, Any] | None:
        if not metadata:
            return None
        sanitized: dict[str, Any] = {}
        for key, value in metadata.items():
            key_text = str(key)
            if any(marker in key_text.lower() for marker in SENSITIVE_FIELD_MARKERS):
                sanitized[key_text] = "[redacted]"
            else:
                sanitized[key_text] = _serialize_value(value)
        return sanitized
