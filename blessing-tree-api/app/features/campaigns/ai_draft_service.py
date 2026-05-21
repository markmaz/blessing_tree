from __future__ import annotations

from collections.abc import Mapping
import re
from typing import Any
import uuid

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_constants import MILESTONE_DEFINITIONS
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.campaigns.studio_validation import require_short_text

AI_STUDIO_SECTIONS = frozenset(
    {"overview", "team", "communications", "schedule", "readiness", "settings"}
)
SCHEDULE_REQUESTED_ACTION_TYPES = frozenset({"event", "milestone", "communication"})


class CampaignStudioAiDraftService:
    def __init__(
        self,
        *,
        campaigns: CampaignService | None = None,
        studio: CampaignStudioService | None = None,
    ) -> None:
        self.campaigns = campaigns or CampaignService()
        self.studio = studio or CampaignStudioService(self.campaigns)

    def draft(
        self,
        db: Session,
        *,
        user_id: str,
        campaign_id: str,
        payload: Mapping[str, object],
    ) -> dict[str, Any]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        section = _validate_section(payload.get("section"))
        prompt = require_short_text(payload.get("prompt"), "prompt", max_length=4000)
        _ = user_id

        if section == "schedule":
            requested_action_type = _validate_schedule_requested_action_type(
                payload.get("requested_action_type")
            )
            return self._build_schedule_draft(
                db,
                campaign_id=campaign_id,
                campaign_name=campaign.name,
                campaign_year=campaign.year,
                prompt=prompt,
                requested_action_type=requested_action_type,
            )

        return self._build_advisory_draft(
            db,
            campaign_id=campaign_id,
            section=section,
            campaign_name=campaign.name,
            prompt=prompt,
        )

    def _build_schedule_draft(
        self,
        db: Session,
        *,
        campaign_id: str,
        campaign_name: str,
        campaign_year: int,
        prompt: str,
        requested_action_type: str | None,
    ) -> dict[str, Any]:
        milestones = self.studio.list_milestones(db, campaign_id)
        templates = self.studio.list_templates(db)
        draft_kind = requested_action_type or _infer_schedule_action_type(prompt)

        assumptions: list[str] = []
        warnings: list[str] = []
        actions: list[dict[str, Any]]

        if draft_kind == "event":
            action = _build_event_action(prompt, campaign_name=campaign_name, campaign_year=campaign_year)
            actions = [action]
        elif draft_kind == "milestone":
            action = _build_milestone_action(
                prompt,
                campaign_year=campaign_year,
                milestones=milestones,
            )
            actions = [action]
        else:
            action, action_assumptions, action_warnings = _build_communication_action(
                prompt,
                campaign_year=campaign_year,
                templates=templates,
            )
            assumptions.extend(action_assumptions)
            warnings.extend(action_warnings)
            actions = [action]

        return {
            "message": (
                f"I drafted {len(actions)} schedule action"
                f"{'s' if len(actions) != 1 else ''} for {campaign_name}."
            ),
            "assumptions": assumptions,
            "warnings": warnings,
            "actions": actions,
        }

    def _build_advisory_draft(
        self,
        db: Session,
        *,
        campaign_id: str,
        section: str,
        campaign_name: str,
        prompt: str,
    ) -> dict[str, Any]:
        _ = prompt
        readiness = self.studio.get_readiness(db, campaign_id)
        templates = self.studio.list_templates(db)

        if section == "communications":
            return {
                "message": (
                    f"I reviewed the communications request for {campaign_name}. "
                    f"There {'is' if len(templates) == 1 else 'are'} currently {len(templates)} "
                    f"template{'s' if len(templates) != 1 else ''} available. "
                    "Phase 1 only drafts normalized schedule actions. Communications template actions are next."
                ),
                "assumptions": [],
                "warnings": [],
                "actions": [],
            }

        if section == "team":
            return {
                "message": (
                    f"I reviewed the team request for {campaign_name}. "
                    "Phase 1 only drafts normalized schedule actions. Team actions will follow in the next AI phase."
                ),
                "assumptions": [],
                "warnings": [],
                "actions": [],
            }

        if section == "readiness":
            return {
                "message": (
                    f"{campaign_name} readiness is currently "
                    f"{readiness['overall_status'].replace('_', ' ').lower()}. "
                    "Phase 1 keeps readiness AI advisory while the action contract is being generalized."
                ),
                "assumptions": [],
                "warnings": [],
                "actions": [],
            }

        return {
            "message": (
                f"I reviewed the {section} request for {campaign_name}. "
                "Phase 1 normalizes the AI action contract around schedule work first."
            ),
            "assumptions": [],
            "warnings": [],
            "actions": [],
        }


def _build_event_action(
    prompt: str,
    *,
    campaign_name: str,
    campaign_year: int,
) -> dict[str, Any]:
    timing = _extract_date_time(prompt, default_year=campaign_year)
    if timing["date_key"] is None:
        raise ServiceError(
            "Include a date like 2026-11-15 or Nov 15 so AI can place the event.",
            status_code=400,
            details={"field": "prompt"},
        )

    title = _extract_title(prompt, "Planning Event")
    event_type = _detect_event_type(prompt)
    start_at = (
        f"{timing['date_key']}T{timing['time_text']}"
        if timing["time_text"]
        else f"{timing['date_key']}T00:00"
    )
    end_at = None if timing["time_text"] else f"{timing['date_key']}T00:00"

    return {
        "id": f"draft-event-{uuid.uuid4()}",
        "action_type": "create_event",
        "section": "schedule",
        "title": f"Create Event: {title}",
        "summary": f"Adds {title} to the campaign calendar for {campaign_name}.",
        "status": "ready",
        "assumptions": [],
        "warnings": [],
        "payload": {
            "title": title,
            "event_type": event_type,
            "start_at": start_at,
            "end_at": end_at,
            "all_day": timing["time_text"] is None,
            "notes": prompt,
        },
        "apply_target": {"api": "campaign_event.create", "method": "POST"},
    }


def _build_milestone_action(
    prompt: str,
    *,
    campaign_year: int,
    milestones: list[Any],
) -> dict[str, Any]:
    timing = _extract_date_time(prompt, default_year=campaign_year)
    if timing["date_key"] is None:
        raise ServiceError(
            "Include a date like 2026-10-01 or Oct 1 so AI can place the milestone.",
            status_code=400,
            details={"field": "prompt"},
        )

    definition = _match_milestone_definition(prompt)
    if definition is None:
        raise ServiceError(
            "Mention which milestone to place, like registration open or pickup start.",
            status_code=400,
            details={"field": "prompt"},
        )

    existing = next(
        (milestone for milestone in milestones if milestone.milestone_key == definition["key"]),
        None,
    )

    return {
        "id": f"draft-milestone-{uuid.uuid4()}",
        "action_type": "create_milestone",
        "section": "schedule",
        "title": f"Place Milestone: {definition['label']}",
        "summary": f"Places {definition['label']} on the campaign calendar.",
        "status": "ready",
        "assumptions": [],
        "warnings": [],
        "payload": {
            "milestone_key": definition["key"],
            "label": definition["label"],
            "occurs_on": timing["date_key"],
            "notes": existing.notes if existing is not None and existing.notes else prompt,
            "sort_order": definition["sort_order"],
        },
        "apply_target": {"api": "campaign_milestone.replace", "method": "PUT"},
    }


def _build_communication_action(
    prompt: str,
    *,
    campaign_year: int,
    templates: list[Any],
) -> tuple[dict[str, Any], list[str], list[str]]:
    template, template_assumption = _match_template(prompt, templates)
    if template is None:
        raise ServiceError(
            "Mention a known template name so AI knows which communication to schedule.",
            status_code=400,
            details={"field": "prompt"},
        )

    milestone = _match_milestone_definition(prompt)
    timing = _extract_date_time(prompt, default_year=campaign_year)
    if milestone is None and timing["date_key"] is None:
        raise ServiceError(
            "Include either a milestone reference or a concrete send date so AI can place the communication.",
            status_code=400,
            details={"field": "prompt"},
        )

    assumptions = [template_assumption] if template_assumption else []
    warnings = [
        "This drafts a planned calendar communication only. Automated delivery is not wired yet."
    ]

    summary = (
        f"Places {template.name} at {milestone['label']}"
        if milestone is not None
        else f"Places {template.name} on {timing['date_key']}"
    )

    return (
        {
            "id": f"draft-communication-{uuid.uuid4()}",
            "action_type": "create_communication_schedule",
            "section": "schedule",
            "title": f"Schedule Communication: {template.name}",
            "summary": summary,
            "status": "ready",
            "assumptions": assumptions.copy(),
            "warnings": warnings.copy(),
            "payload": {
                "template_id": str(template.id),
                "milestone_key": milestone["key"] if milestone is not None else None,
                "scheduled_for": (
                    f"{timing['date_key']}T{timing['time_text'] or '09:00'}"
                    if timing["date_key"] is not None
                    else None
                ),
                "status": "SCHEDULED" if timing["date_key"] is not None else "DRAFT",
                "notes": prompt,
            },
            "apply_target": {"api": "campaign_communication_schedule.create", "method": "POST"},
        },
        assumptions,
        warnings,
    )


def _validate_section(value: object) -> str:
    section = str(value or "").strip().lower()
    if section not in AI_STUDIO_SECTIONS:
        raise ServiceError(
            "Studio section is invalid",
            status_code=400,
            details={"field": "section", "allowed_values": sorted(AI_STUDIO_SECTIONS)},
        )
    return section


def _validate_schedule_requested_action_type(value: object) -> str | None:
    if value in (None, ""):
        return None
    requested_type = str(value).strip().lower()
    if requested_type not in SCHEDULE_REQUESTED_ACTION_TYPES:
        raise ServiceError(
            "requested_action_type is invalid",
            status_code=400,
            details={"field": "requested_action_type", "allowed_values": sorted(SCHEDULE_REQUESTED_ACTION_TYPES)},
        )
    return requested_type


def _infer_schedule_action_type(prompt: str) -> str:
    normalized = _normalize_text(prompt)
    if any(term in normalized for term in ("email", "template", "reminder", "communication")):
        return "communication"
    if _match_milestone_definition(prompt) is not None:
        return "milestone"
    return "event"


def _match_milestone_definition(prompt: str) -> dict[str, Any] | None:
    normalized_prompt = _normalize_text(prompt)
    for sort_order, (key, label) in enumerate(MILESTONE_DEFINITIONS.items(), start=1):
        normalized_label = _normalize_text(label)
        if normalized_label in normalized_prompt or key.replace("_", " ") in normalized_prompt:
            return {"key": key, "label": label, "sort_order": sort_order}
    return None


def _match_template(prompt: str, templates: list[Any]) -> tuple[Any | None, str | None]:
    normalized_prompt = _normalize_text(prompt)
    for template in templates:
        if _normalize_text(template.name) in normalized_prompt:
            return template, None
        if template.template_key.replace("_", " ") in normalized_prompt:
            return template, None

    if len(templates) == 1:
        return templates[0], f"Used the only available template: {templates[0].name}."

    return None, None


def _extract_title(prompt: str, fallback: str) -> str:
    quoted_match = re.search(r'"([^"]+)"', prompt)
    if quoted_match and quoted_match.group(1):
        return quoted_match.group(1).strip()

    cleaned = re.sub(r"\b(add|create|schedule|plan|draft)\b", "", prompt, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bon\b.+$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bfor\b.+$", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()
    if not cleaned:
        return fallback
    return " ".join(part.capitalize() for part in cleaned.split())


def _detect_event_type(prompt: str) -> str:
    normalized = prompt.lower()
    if "volunteer" in normalized:
        return "VOLUNTEER"
    if "sponsor" in normalized:
        return "SPONSOR"
    if "pickup" in normalized:
        return "PICKUP"
    if "gift" in normalized:
        return "GIFT"
    if "donation" in normalized:
        return "DONATION"
    if "recipient" in normalized or "family" in normalized:
        return "RECIPIENT"
    if "communicat" in normalized or "email" in normalized:
        return "COMMUNICATION"
    return "GENERAL"


def _extract_date_time(prompt: str, *, default_year: int) -> dict[str, str | None]:
    iso_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", prompt)
    if iso_match:
        return {"date_key": iso_match.group(1), "time_text": _extract_time(prompt)}

    slash_match = re.search(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", prompt)
    if slash_match:
        month, day, year = slash_match.group(1), slash_match.group(2), slash_match.group(3)
        return {
            "date_key": f"{year}-{month.zfill(2)}-{day.zfill(2)}",
            "time_text": _extract_time(prompt),
        }

    month_match = re.search(
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(20\d{2}))?\b",
        prompt,
        flags=re.IGNORECASE,
    )
    if month_match:
        month_name = month_match.group(1).lower()
        day = month_match.group(2)
        year = month_match.group(3) or str(default_year)
        month_index = _MONTH_NAMES.index(month_name) + 1
        return {
            "date_key": f"{year}-{str(month_index).zfill(2)}-{day.zfill(2)}",
            "time_text": _extract_time(prompt),
        }

    return {"date_key": None, "time_text": None}


def _extract_time(prompt: str) -> str | None:
    twenty_four = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", prompt)
    if twenty_four:
        return f"{twenty_four.group(1).zfill(2)}:{twenty_four.group(2)}"

    twelve_hour = re.search(r"\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b", prompt, flags=re.IGNORECASE)
    if not twelve_hour:
        return None

    hour = int(twelve_hour.group(1)) % 12
    if twelve_hour.group(3).lower() == "pm":
        hour += 12
    minute = twelve_hour.group(2) or "00"
    return f"{str(hour).zfill(2)}:{minute}"


def _normalize_text(value: str) -> str:
    return " ".join(value.lower().replace("_", " ").replace("-", " ").split())


_MONTH_NAMES = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
]
