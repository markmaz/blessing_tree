from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Any

from app.exceptions.service_error import ServiceError
from app.features.campaigns.studio_validation import validate_audience
from app.features.campaigns.validation import validate_status_transition
from app.models.campaign_member_constants import (
    APP_ACCESS_STATUS_NONE,
    CAMPAIGN_MEMBER_TYPE_VOLUNTEER,
)


class NormalizationState:
    def __init__(
        self,
        *,
        campaign_name: str,
        templates,
        milestones,
        milestone_definitions,
        teams,
        members,
        readiness,
        is_app_admin: bool,
        campaign_status: str,
    ) -> None:
        self.campaign_name = campaign_name
        self.templates = {template.name.casefold(): template for template in templates}
        self.templates_by_key = {template.template_key.casefold(): template for template in templates}
        self.milestones = {milestone.milestone_key: milestone for milestone in milestones}
        self.milestone_catalog = {
            definition.milestone_key: {
                "key": definition.milestone_key,
                "label": definition.label,
                "sort_order": definition.default_sort_order,
            }
            for definition in milestone_definitions
        }
        self.teams = {team.name.casefold(): team for team in teams}
        self.members = {member.display_name.casefold(): member for member in members}
        self.readiness = readiness
        self.is_app_admin = is_app_admin
        self.campaign_status = campaign_status
        self.template_refs: dict[str, str] = {}
        self.team_refs: dict[str, str] = {}
        self.team_role_refs: dict[tuple[str, str], str] = {}
        self.member_refs: dict[str, str] = {}
        self.extra_warnings: list[str] = []


def normalize_llm_draft(
    raw: Mapping[str, Any],
    *,
    section: str,
    allowed_actions: tuple[str, ...],
    campaign,
    templates,
    milestones,
    milestone_definitions,
    teams,
    members,
    readiness,
    is_app_admin: bool,
) -> dict[str, Any]:
    actions = raw.get("actions")
    if not isinstance(actions, list):
        raise ValueError("actions must be a list")

    state = NormalizationState(
        campaign_name=campaign.name,
        templates=templates,
        milestones=milestones,
        milestone_definitions=milestone_definitions,
        teams=teams,
        members=members,
        readiness=readiness,
        is_app_admin=is_app_admin,
        campaign_status=campaign.status,
    )
    normalized_actions = [
        _normalize_action(item, section=section, allowed_actions=allowed_actions, state=state, campaign=campaign)
        for item in actions
        if isinstance(item, Mapping)
    ]
    normalized_actions = [action for action in normalized_actions if action is not None]

    message = str(raw.get("message") or "").strip()
    if not message:
        message = (
            f"I drafted {len(normalized_actions)} {section} action"
            f"{'s' if len(normalized_actions) != 1 else ''} for {campaign.name}."
        )

    return {
        "message": message,
        "assumptions": _string_list(raw.get("assumptions")),
        "warnings": _merge_unique(_string_list(raw.get("warnings")), state.extra_warnings),
        "actions": normalized_actions,
    }


def _normalize_action(
    item: Mapping[str, Any],
    *,
    section: str,
    allowed_actions: tuple[str, ...],
    state: NormalizationState,
    campaign,
) -> dict[str, Any] | None:
    action_type = str(item.get("action_type") or "").strip()
    if action_type not in allowed_actions:
        raise ValueError(f"Unsupported action_type {action_type} for section {section}")
    payload = item.get("payload")
    if not isinstance(payload, Mapping):
        raise ValueError("Action payload must be an object")
    if action_type == "create_event":
        return _event_action(payload, state)
    if action_type == "create_milestone":
        return _milestone_action(payload, state)
    if action_type == "create_template":
        return _template_action(payload, state)
    if action_type == "create_communication_schedule":
        return _schedule_action(payload, state)
    if action_type == "create_team":
        return _team_action(payload, state)
    if action_type == "create_team_role":
        return _team_role_action(payload, state)
    if action_type == "create_member":
        return _member_action(payload, state)
    if action_type == "assign_member_to_team":
        return _assign_member_action(payload, state)
    if action_type == "update_campaign_settings":
        return _settings_action(payload, campaign)
    if action_type == "suggest_status_change":
        return _status_action(payload, state, campaign)
    return None


def _event_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    title = _required_text(payload.get("title"), "title")
    start_at = _required_text(payload.get("start_at"), "start_at")
    return _action(
        "create_event",
        "schedule",
        f"Create Event: {title}",
        f"Adds {title} to the campaign calendar for {state.campaign_name}.",
        {
            "title": title,
            "event_type": _optional_text(payload.get("event_type")) or "GENERAL",
            "start_at": start_at,
            "end_at": _optional_text(payload.get("end_at")),
            "all_day": bool(payload.get("all_day", False)),
            "notes": _optional_text(payload.get("notes")),
        },
        {"api": "campaign_event.create", "method": "POST"},
    )


def _milestone_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    milestone_key = _resolve_milestone_key(payload, state)
    definition = state.milestone_catalog[milestone_key]
    label = str(definition["label"])
    return _action(
        "create_milestone",
        "schedule",
        f"Place Milestone: {label}",
        f"Places {label} on the campaign calendar.",
        {
            "milestone_key": milestone_key,
            "label": label,
            "occurs_on": _required_text(payload.get("occurs_on"), "occurs_on"),
            "notes": _optional_text(payload.get("notes")),
            "sort_order": int(definition["sort_order"]),
        },
        {"api": "campaign_milestone.replace", "method": "PUT"},
    )


def _template_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    name = _required_text(payload.get("name"), "name")
    audience = validate_audience(_optional_text(payload.get("audience")) or "GENERAL")
    template_ref = f"draft-template-ref-{uuid.uuid4()}"
    state.template_refs[name.casefold()] = template_ref
    subject_template = _resolve_template_subject(
        payload,
        template_name=name,
        campaign_name=state.campaign_name,
    )
    body_template = _resolve_template_body(payload, template_name=name)
    return _action(
        "create_template",
        "communications",
        f"Create Template: {name}",
        f"Creates a {audience.lower()} email template for {state.campaign_name}.",
        {
            "template_ref": template_ref,
            "template_key": _derive_template_key(name),
            "name": name,
            "audience": audience,
            "subject_template": subject_template,
            "body_template": body_template,
            "is_active": bool(payload.get("is_active", True)),
        },
        {"api": "communication_template.create", "method": "POST"},
    )


def _schedule_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    template_id = None
    template_ref = None
    template_name = _optional_text(payload.get("template_name"))
    template_key = _optional_text(payload.get("template_key"))
    if template_name and template_name.casefold() in state.template_refs:
        template_ref = state.template_refs[template_name.casefold()]
    elif template_name and template_name.casefold() in state.templates:
        template_id = str(state.templates[template_name.casefold()].id)
    elif template_key and template_key.casefold() in state.templates_by_key:
        template_id = str(state.templates_by_key[template_key.casefold()].id)
    else:
        raise ValueError("Communication schedule needs template_name or template_key that matches a known or drafted template")

    milestone_key = _resolve_optional_milestone_key(payload, state)
    scheduled_for = _optional_text(payload.get("scheduled_for"))
    if milestone_key is None and scheduled_for is None:
        raise ValueError("Communication schedule needs milestone_key or scheduled_for")
    state.extra_warnings.append("This drafts a planned calendar communication only. Automated delivery is not wired yet.")
    return _action(
        "create_communication_schedule",
        "communications",
        f"Schedule Communication: {template_name or template_key or 'Template'}",
        f"Places {template_name or template_key or 'communication'} on the calendar.",
        {
            "template_id": template_id,
            "template_ref": template_ref,
            "milestone_key": milestone_key,
            "scheduled_for": scheduled_for,
            "status": _optional_text(payload.get("status")) or ("SCHEDULED" if scheduled_for else "DRAFT"),
            "notes": _optional_text(payload.get("notes")),
        },
        {"api": "campaign_communication_schedule.create", "method": "POST"},
    )


def _team_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    name = _required_text(payload.get("name"), "name")
    team_ref = f"draft-team-ref-{uuid.uuid4()}"
    state.team_refs[name.casefold()] = team_ref
    return _action("create_team", "team", f"Create Team: {name}", f"Creates the {name} team in {state.campaign_name}.", {"team_ref": team_ref, "name": name, "description": _optional_text(payload.get("description")), "is_active": bool(payload.get("is_active", True))}, {"api": "campaign_team.create", "method": "POST"})


def _team_role_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    team_name = _required_text(payload.get("team_name"), "team_name")
    role_name = _required_text(payload.get("name"), "name")
    team = state.teams.get(team_name.casefold())
    team_ref = state.team_refs.get(team_name.casefold())
    if team is None and team_ref is None:
        raise ValueError("Team role references an unknown team_name")
    role_ref = f"draft-team-role-ref-{uuid.uuid4()}"
    state.team_role_refs[(team_name.casefold(), role_name.casefold())] = role_ref
    return _action("create_team_role", "team", f"Create Team Role: {role_name}", f"Adds the {role_name} role to the selected team.", {"team_id": str(team.id) if team is not None else None, "team_ref": team_ref, "role_ref": role_ref, "name": role_name, "description": _optional_text(payload.get("description")), "sort_order": int(payload.get("sort_order") or 0), "is_active": bool(payload.get("is_active", True))}, {"api": "campaign_team_role.create", "method": "POST"})


def _member_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    display_name = _required_text(payload.get("display_name"), "display_name")
    member_ref = f"draft-member-ref-{uuid.uuid4()}"
    state.member_refs[display_name.casefold()] = member_ref
    return _action("create_member", "team", f"Create Member: {display_name}", f"Adds {display_name} to the campaign roster.", {"member_ref": member_ref, "display_name": display_name, "email": _optional_text(payload.get("email")), "phone": _optional_text(payload.get("phone")), "notes": _optional_text(payload.get("notes")), "member_type": (_optional_text(payload.get("member_type")) or CAMPAIGN_MEMBER_TYPE_VOLUNTEER).lower(), "app_access_status": (_optional_text(payload.get("app_access_status")) or APP_ACCESS_STATUS_NONE).lower(), "is_active": bool(payload.get("is_active", True))}, {"api": "campaign_member.create", "method": "POST"})


def _assign_member_action(payload: Mapping[str, Any], state: NormalizationState) -> dict[str, Any]:
    team_name = _required_text(payload.get("team_name"), "team_name")
    member_name = _required_text(payload.get("member_name"), "member_name")
    role_name = _optional_text(payload.get("team_role_name"))
    team = state.teams.get(team_name.casefold())
    member = state.members.get(member_name.casefold())
    team_ref = state.team_refs.get(team_name.casefold())
    member_ref = state.member_refs.get(member_name.casefold())
    if team is None and team_ref is None:
        raise ValueError("Team membership references an unknown team_name")
    if member is None and member_ref is None:
        raise ValueError("Team membership references an unknown member_name")
    team_role_ref = state.team_role_refs.get((team_name.casefold(), role_name.casefold())) if role_name else None
    team_role_id = None
    if role_name and team is not None:
        team_role = next((role for role in team.roles if role.name.casefold() == role_name.casefold()), None)
        team_role_id = str(team_role.id) if team_role is not None else None
    summary = f"Assigns {member_name} to {team_name} as {role_name}." if role_name else f"Assigns {member_name} to {team_name} as a team member."
    return _action("assign_member_to_team", "team", f"Assign Member: {member_name}", summary, {"team_id": str(team.id) if team is not None else None, "team_ref": team_ref, "member_id": str(member.id) if member is not None else None, "member_ref": member_ref, "team_role_id": team_role_id, "team_role_ref": team_role_ref}, {"api": "campaign_team_member.create", "method": "POST"})


def _settings_action(payload: Mapping[str, Any], campaign) -> dict[str, Any]:
    next_payload = {
        "name": _optional_text(payload.get("name")) or campaign.name,
        "year": int(payload.get("year") or campaign.year),
        "description": payload.get("description") if "description" in payload else campaign.description,
        "status": _optional_text(payload.get("status")) or campaign.status,
        "start_date": payload.get("start_date") if "start_date" in payload else (campaign.start_date.isoformat() if campaign.start_date else None),
        "end_date": payload.get("end_date") if "end_date" in payload else (campaign.end_date.isoformat() if campaign.end_date else None),
    }
    return _action("update_campaign_settings", "settings", "Update Campaign Settings", "Updates the campaign settings.", next_payload, {"api": "campaign.update", "method": "PATCH"}, status="needs_review")


def _status_action(payload: Mapping[str, Any], state: NormalizationState, campaign) -> dict[str, Any]:
    target_status = _required_text(payload.get("status"), "status").upper()
    next_payload = {"name": campaign.name, "year": campaign.year, "description": campaign.description, "status": target_status, "start_date": campaign.start_date.isoformat() if campaign.start_date else None, "end_date": campaign.end_date.isoformat() if campaign.end_date else None}
    warnings: list[str] = []
    status = "needs_review"
    try:
        validate_status_transition(state.campaign_status, target_status, is_app_admin=state.is_app_admin)
    except ServiceError:
        status = "blocked"
        warnings.append(f"The transition from {state.campaign_status} to {target_status} is not allowed for your current campaign role.")
    phase_key = {"ACTIVE": "activate", "CLOSED": "close"}.get(target_status)
    if phase_key and str(state.readiness.get("phase_status", {}).get(phase_key, "READY")).upper() != "READY":
        status = "blocked"
        warnings.append("Readiness still needs attention before this lifecycle move should be applied.")
    return _action("suggest_status_change", "settings", f"Change Campaign Status: {target_status}", f"Moves the campaign from {state.campaign_status} to {target_status}.", next_payload, {"api": "campaign.update", "method": "PATCH"}, status=status, warnings=warnings)


def _action(action_type: str, section: str, title: str, summary: str, payload: Mapping[str, Any], apply_target: Mapping[str, Any], *, status: str = "ready", warnings: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": f"draft-{action_type}-{uuid.uuid4()}",
        "action_type": action_type,
        "section": section,
        "title": title,
        "summary": summary,
        "status": status,
        "assumptions": [],
        "warnings": warnings or [],
        "payload": dict(payload),
        "apply_target": dict(apply_target),
    }


def _resolve_milestone_key(payload: Mapping[str, Any], state: NormalizationState) -> str:
    key = _optional_text(payload.get("milestone_key"))
    if key and key in state.milestone_catalog:
        return key
    name = _optional_text(payload.get("milestone_name"))
    if name:
        normalized = name.casefold()
        for milestone_key, definition in state.milestone_catalog.items():
            label = str(definition["label"])
            if label.casefold() == normalized or milestone_key.replace("_", " ") == normalized:
                return milestone_key
    raise ValueError("Milestone action references an unknown milestone")


def _resolve_optional_milestone_key(payload: Mapping[str, Any], state: NormalizationState) -> str | None:
    if payload.get("milestone_key") in (None, "") and payload.get("milestone_name") in (None, ""):
        return None
    return _resolve_milestone_key(payload, state)


def _derive_template_key(name: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in name)
    normalized = "_".join(part for part in cleaned.split("_") if part)
    return normalized[:64] or f"template_{uuid.uuid4().hex[:8]}"


def _resolve_template_subject(
    payload: Mapping[str, Any],
    *,
    template_name: str,
    campaign_name: str,
) -> str:
    for candidate_key in (
        "subject_template",
        "subject",
        "subject_line",
        "subjectLine",
        "email_subject",
        "emailSubject",
        "title",
    ):
        text = _optional_text(payload.get(candidate_key))
        if text:
            return text
    return f"{template_name} for {campaign_name}"


def _resolve_template_body(payload: Mapping[str, Any], *, template_name: str) -> str:
    for candidate_key in (
        "body_template",
        "body",
        "content",
        "message",
        "email_body",
        "emailBody",
        "html_body",
        "htmlBody",
        "text_body",
        "textBody",
    ):
        text = _optional_text(payload.get(candidate_key))
        if text:
            return text
    raise ValueError(f"body_template is required for template {template_name}")


def _required_text(value: object, field: str) -> str:
    text = _optional_text(value)
    if not text:
        raise ValueError(f"{field} is required")
    return text


def _optional_text(value: object) -> str | None:
    if value in (None, ""):
        return None
    return str(value).strip() or None


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _merge_unique(first: list[str], second: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for item in [*first, *second]:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
    return merged
