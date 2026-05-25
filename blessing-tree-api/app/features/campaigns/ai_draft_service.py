from __future__ import annotations

from collections.abc import Mapping
from datetime import date, timedelta
import re
from typing import Any
import uuid

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.campaigns.ai_llm_draft_service import CampaignStudioLlmDraftService
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.campaigns.validation import validate_status_transition
from app.features.campaigns.team_workspace_service import CampaignTeamWorkspaceService
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
        team_workspace: CampaignTeamWorkspaceService | None = None,
    ) -> None:
        self.campaigns = campaigns or CampaignService()
        self.studio = studio or CampaignStudioService(self.campaigns)
        self.team_workspace = team_workspace or CampaignTeamWorkspaceService(self.campaigns)
        self.llm_drafts = CampaignStudioLlmDraftService(
            campaigns=self.campaigns,
            studio=self.studio,
            team_workspace=self.team_workspace,
        )

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
        requested_action_type = _validate_schedule_requested_action_type(
            payload.get("requested_action_type")
        )

        llm_draft, llm_warning = self.llm_drafts.draft_or_none(
            db,
            user_id=user_id,
            campaign_id=campaign_id,
            campaign=campaign,
            section=section,
            prompt=prompt,
            requested_action_type=requested_action_type,
        )
        if llm_draft is not None:
            return llm_draft

        if section == "schedule":
            draft = self._build_schedule_draft(
                db,
                campaign_id=campaign_id,
                campaign_name=campaign.name,
                campaign_year=campaign.year,
                prompt=prompt,
                requested_action_type=requested_action_type,
            )
            return _with_runtime_warning(draft, llm_warning)

        if section == "communications":
            draft = self._build_communications_draft(
                db,
                campaign_id=campaign_id,
                campaign_name=campaign.name,
                campaign_year=campaign.year,
                prompt=prompt,
            )
            return _with_runtime_warning(draft, llm_warning)

        if section == "team":
            draft = self._build_team_draft(
                db,
                campaign_id=campaign_id,
                campaign_name=campaign.name,
                prompt=prompt,
            )
            return _with_runtime_warning(draft, llm_warning)

        if section == "readiness":
            draft = self._build_readiness_draft(
                db,
                campaign_id=campaign_id,
                campaign=campaign,
                prompt=prompt,
            )
            return _with_runtime_warning(draft, llm_warning)

        if section == "settings":
            draft = self._build_settings_draft(
                db,
                user_id=user_id,
                campaign_id=campaign_id,
                campaign=campaign,
                prompt=prompt,
            )
            return _with_runtime_warning(draft, llm_warning)

        draft = self._build_advisory_draft(
            db,
            campaign_id=campaign_id,
            section=section,
            campaign_name=campaign.name,
            prompt=prompt,
        )
        return _with_runtime_warning(draft, llm_warning)

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
        templates = self.studio.list_templates(db, campaign_id)
        milestone_catalog = _milestone_catalog_from_definitions(
            self.studio.milestone_definitions.list_active_definitions(db)
        )
        draft_kind = requested_action_type or _infer_schedule_action_type(prompt, milestone_catalog)

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
                milestone_catalog=milestone_catalog,
            )
            actions = [action]
        else:
            action, action_assumptions, action_warnings = _build_communication_action(
                prompt,
                campaign_year=campaign_year,
                templates=templates,
                milestone_catalog=milestone_catalog,
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

    def _build_readiness_draft(
        self,
        db: Session,
        *,
        campaign_id: str,
        campaign,
        prompt: str,
    ) -> dict[str, Any]:
        if _is_readiness_explanation_prompt(prompt):
            return self._build_advisory_draft(
                db,
                campaign_id=campaign_id,
                section="readiness",
                campaign_name=campaign.name,
                prompt=prompt,
            )

        readiness = self.studio.get_readiness(db, campaign_id)
        milestones = self.studio.list_milestones(db, campaign_id)
        templates = self.studio.list_templates(db, campaign_id)
        milestone_catalog = _milestone_catalog_from_definitions(
            self.studio.milestone_definitions.list_active_definitions(db)
        )
        selected_items = _select_readiness_items_for_prompt(prompt, readiness)
        readiness_context: dict[str, Any] = {
            "created_template_ref": None,
            "created_template_name": None,
            "created_schedule": False,
        }

        assumptions: list[str] = []
        warnings: list[str] = []
        actions: list[dict[str, Any]] = []

        for item in selected_items:
            item_actions, item_assumptions, item_warnings = _build_actions_for_readiness_item(
                item,
                campaign=campaign,
                milestones=milestones,
                templates=templates,
                milestone_catalog=milestone_catalog,
                readiness_context=readiness_context,
            )
            actions.extend(item_actions)
            assumptions.extend(item_assumptions)
            warnings.extend(item_warnings)

        if not actions:
            return {
                "message": (
                    f"I reviewed readiness for {campaign.name}, but I could not draft an actionable fix bundle from the current findings."
                ),
                "assumptions": assumptions,
                "warnings": warnings
                or [
                    "The remaining readiness items still need a specific person, date range, or policy decision before Campaign AI can draft concrete actions."
                ],
                "actions": [],
            }

        return {
            "message": (
                f"I drafted {len(actions)} readiness action"
                f"{'s' if len(actions) != 1 else ''} for {campaign.name}."
            ),
            "assumptions": assumptions,
            "warnings": warnings,
            "actions": actions,
        }

    def _build_team_draft(
        self,
        db: Session,
        *,
        campaign_id: str,
        campaign_name: str,
        prompt: str,
    ) -> dict[str, Any]:
        if _is_team_explanation_prompt(prompt):
            return self._build_advisory_draft(
                db,
                campaign_id=campaign_id,
                section="team",
                campaign_name=campaign_name,
                prompt=prompt,
            )

        workspace = self.team_workspace.get_workspace_payload(db, campaign_id)
        existing_teams = workspace["teams"]
        existing_members = workspace["members"]

        actions: list[dict[str, Any]] = []
        assumptions: list[str] = []
        warnings: list[str] = []

        team_name = _extract_team_name(prompt)
        team_ref: str | None = None
        team_id: str | None = None
        if team_name is not None:
            matched_team = _match_workspace_team(team_name, existing_teams)
            if matched_team is None:
                team_ref = f"draft-team-ref-{uuid.uuid4()}"
                actions.append(
                    _build_team_action(
                        campaign_name=campaign_name,
                        team_name=team_name,
                        team_ref=team_ref,
                    )
                )
            else:
                team_id = str(_read_value(matched_team, "id"))
                assumptions.append(f"Using existing team {_read_value(matched_team, 'name')}.")

        role_names = _extract_team_role_names(prompt)
        role_refs_by_name: dict[str, str] = {}
        if role_names and team_name is not None:
            team_for_roles = _match_workspace_team(team_name, existing_teams)
            team_roles = _read_value(team_for_roles, "roles", default=[]) if team_for_roles else []
            for index, role_name in enumerate(role_names, start=1):
                existing_role = _match_team_role(role_name, team_roles)
                if existing_role is not None:
                    assumptions.append(
                        f"Using existing team role {_read_value(existing_role, 'name')} in {_read_value(team_for_roles, 'name')}."
                    )
                    continue

                role_ref = f"draft-team-role-ref-{uuid.uuid4()}"
                role_refs_by_name[_normalize_text(role_name)] = role_ref
                actions.append(
                    _build_team_role_action(
                        role_name=role_name,
                        team_id=team_id,
                        team_ref=team_ref,
                        role_ref=role_ref,
                        sort_order=index,
                    )
                )

        member_name = _extract_member_name(prompt)
        member_ref: str | None = None
        member_id: str | None = None
        if member_name is not None:
            matched_member = _match_workspace_member(member_name, existing_members)
            if matched_member is None:
                member_ref = f"draft-member-ref-{uuid.uuid4()}"
                actions.append(
                    _build_member_action(
                        member_name=member_name,
                        member_ref=member_ref,
                    )
                )
            else:
                member_id = str(_read_value(matched_member, "id"))
                assumptions.append(
                    f"Using existing member {_read_value(matched_member, 'display_name', fallback_key='display_name')}."
                )

        assignment_role_name = (
            _extract_assignment_role_name(prompt, role_names)
            if member_name is not None and role_names
            else None
        )
        normalized_role_name = (
            _normalize_text(assignment_role_name)
            if assignment_role_name is not None
            else (_normalize_text(role_names[0]) if member_name is not None and role_names else None)
        )
        team_role_ref = (
            role_refs_by_name.get(normalized_role_name) if normalized_role_name is not None else None
        )
        team_role_id = None
        if member_name is not None and role_names and team_name is not None and team_role_ref is None:
            existing_team = _match_workspace_team(team_name, existing_teams)
            if existing_team is not None:
                existing_role = _match_team_role(
                    role_names[0],
                    _read_value(existing_team, "roles", default=[]),
                )
                if existing_role is not None:
                    team_role_id = str(_read_value(existing_role, "id"))

        if member_name is not None and team_name is not None:
            actions.append(
                _build_member_assignment_action(
                    member_name=member_name,
                    team_name=team_name,
                    team_id=team_id,
                    team_ref=team_ref,
                    member_id=member_id,
                    member_ref=member_ref,
                    team_role_id=team_role_id,
                    team_role_ref=team_role_ref,
                    team_role_name=assignment_role_name or (role_names[0] if role_names else None),
                )
            )

        if not actions:
            return {
                "message": (
                    f"I reviewed the team request for {campaign_name}, but I could not turn it into a concrete Team action bundle yet."
                ),
                "assumptions": assumptions,
                "warnings": [
                    "Try naming the team, member, or team role more explicitly so Campaign AI can draft a concrete Team bundle."
                ],
                "actions": [],
            }

        return {
            "message": (
                f"I drafted {len(actions)} team action"
                f"{'s' if len(actions) != 1 else ''} for {campaign_name}."
            ),
            "assumptions": assumptions,
            "warnings": warnings,
            "actions": actions,
        }

    def _build_settings_draft(
        self,
        db: Session,
        *,
        user_id: str,
        campaign_id: str,
        campaign,
        prompt: str,
    ) -> dict[str, Any]:
        if _is_settings_explanation_prompt(prompt):
            return self._build_advisory_draft(
                db,
                campaign_id=campaign_id,
                section="settings",
                campaign_name=campaign.name,
                prompt=prompt,
            )

        readiness = self.studio.get_readiness(db, campaign_id)
        is_app_admin = self.campaigns.authorization.user_is_app_admin(db, user_id)
        assumptions: list[str] = []
        warnings: list[str] = []
        actions: list[dict[str, Any]] = []
        next_payload = _campaign_settings_payload(campaign)
        changed_fields: list[str] = []

        next_name = _extract_campaign_name(prompt)
        if next_name and next_name != next_payload["name"]:
            next_payload["name"] = next_name
            changed_fields.append("name")

        next_year = _extract_campaign_year(prompt)
        if next_year and next_year != next_payload["year"]:
            next_payload["year"] = next_year
            changed_fields.append("year")

        next_description = _extract_campaign_description(prompt, campaign_name=campaign.name, campaign_year=campaign.year)
        if next_description is not None and next_description != next_payload["description"]:
            next_payload["description"] = next_description
            changed_fields.append("description")
            if "description" not in _normalize_text(prompt):
                assumptions.append("Drafted a campaign description from the prompt because no explicit description text was supplied.")

        date_range = _extract_campaign_date_range(prompt, default_year=campaign.year)
        if date_range is not None:
            start_date, end_date = date_range
            if start_date != next_payload["start_date"]:
                next_payload["start_date"] = start_date
                changed_fields.append("start_date")
            if end_date != next_payload["end_date"]:
                next_payload["end_date"] = end_date
                changed_fields.append("end_date")

        target_status = _extract_campaign_status_target(prompt)
        if target_status is not None:
            status_action = _build_status_change_action(
                campaign,
                readiness=readiness,
                next_payload=next_payload,
                target_status=target_status,
                is_app_admin=is_app_admin,
            )
            actions.append(status_action)
            if status_action["status"] == "blocked" and changed_fields:
                actions.insert(
                    0,
                    _build_campaign_settings_update_action(
                        next_payload,
                        title="Update Campaign Settings",
                        summary="Updates campaign settings that can be saved before the lifecycle change is resolved.",
                        assumptions=assumptions,
                        warnings=warnings,
                    ),
                )
            return {
                "message": (
                    f"I drafted {len(actions)} settings action"
                    f"{'s' if len(actions) != 1 else ''} for {campaign.name}."
                ),
                "assumptions": assumptions,
                "warnings": warnings,
                "actions": actions,
            }

        if changed_fields:
            actions.append(
                _build_campaign_settings_update_action(
                    next_payload,
                    title="Update Campaign Settings",
                    summary=_build_settings_summary(changed_fields),
                    assumptions=assumptions,
                    warnings=warnings,
                )
            )

        if not actions:
            return {
                "message": (
                    f"I reviewed the settings request for {campaign.name}, but I still need a more specific change to draft."
                ),
                "assumptions": [],
                "warnings": [
                    "Try naming the lifecycle change, description, or date range you want so Campaign AI can draft a concrete Settings action."
                ],
                "actions": [],
            }

        return {
            "message": (
                f"I drafted {len(actions)} settings action"
                f"{'s' if len(actions) != 1 else ''} for {campaign.name}."
            ),
            "assumptions": assumptions,
            "warnings": warnings,
            "actions": actions,
        }

    def _build_communications_draft(
        self,
        db: Session,
        *,
        campaign_id: str,
        campaign_name: str,
        campaign_year: int,
        prompt: str,
    ) -> dict[str, Any]:
        templates = self.studio.list_templates(db, campaign_id)
        milestone_catalog = _milestone_catalog_from_definitions(
            self.studio.milestone_definitions.list_active_definitions(db)
        )
        template_action, assumptions, warnings, template_ref = _build_template_creation_action(
            prompt,
            campaign_name=campaign_name,
            templates=templates,
        )
        actions: list[dict[str, Any]] = [template_action]

        if _communications_request_includes_schedule(
            prompt,
            campaign_year=campaign_year,
            milestone_catalog=milestone_catalog,
        ):
            schedule_action, schedule_assumptions, schedule_warnings = (
                _build_communication_schedule_from_template_ref(
                    prompt,
                    campaign_year=campaign_year,
                    template_ref=template_ref,
                    template_name=str(template_action["payload"]["name"]),
                    milestone_catalog=milestone_catalog,
                )
            )
            actions.append(schedule_action)
            assumptions.extend(schedule_assumptions)
            warnings.extend(schedule_warnings)

        return {
            "message": (
                f"I drafted {len(actions)} communications action"
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

        if section == "team":
            return {
                "message": (
                    f"I reviewed the team request for {campaign_name}. "
                    "Campaign AI can explain roster concepts here, and it now drafts concrete team bundles when the prompt names a team, member, or team role."
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
                    "Campaign AI can explain readiness findings here, and it can now draft fix bundles when the prompt asks it to clear gaps or unblock the next phase."
                ),
                "assumptions": [],
                "warnings": [],
                "actions": [],
            }

        if section == "settings":
            return {
                "message": (
                    f"I reviewed the settings request for {campaign_name}. "
                    "Campaign AI can explain lifecycle controls here, and it now drafts concrete settings updates and status suggestions when the prompt names the change you want."
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
    milestone_catalog: list[dict[str, Any]],
) -> dict[str, Any]:
    timing = _extract_date_time(prompt, default_year=campaign_year)
    if timing["date_key"] is None:
        raise ServiceError(
            "Include a date like 2026-10-01 or Oct 1 so AI can place the milestone.",
            status_code=400,
            details={"field": "prompt"},
        )

    definition = _match_milestone_definition(prompt, milestone_catalog)
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
    milestone_catalog: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[str], list[str]]:
    template, template_assumption = _match_template(prompt, templates)
    if template is None:
        raise ServiceError(
            "Mention a known template name so AI knows which communication to schedule.",
            status_code=400,
            details={"field": "prompt"},
        )

    milestone = _match_milestone_definition(prompt, milestone_catalog)
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


def _build_template_creation_action(
    prompt: str,
    *,
    campaign_name: str,
    templates: list[Any],
) -> tuple[dict[str, Any], list[str], list[str], str]:
    audience = _detect_template_audience(prompt)
    template_name = _extract_template_name(prompt, audience=audience)
    template_key = _derive_unique_template_key(template_name, templates)
    subject_template = _build_template_subject(prompt, template_name)
    body_template = _build_template_body(
        prompt,
        audience=audience,
    )
    template_ref = f"draft-template-ref-{uuid.uuid4()}"
    assumptions: list[str] = []
    warnings: list[str] = []

    existing_match, _ = _match_template(prompt, templates)
    normalized_prompt = _normalize_text(prompt)
    if existing_match is not None and any(
        term in normalized_prompt for term in ("update", "revise", "edit", "change")
    ):
        warnings.append(
            f"Matched existing template {existing_match.name}, but AI drafted a new template because updating existing templates requires explicit confirmation."
        )
    elif existing_match is not None:
        assumptions.append(
            f"Drafted a new template instead of reusing existing template {existing_match.name}."
        )

    return (
        {
            "id": f"draft-template-{uuid.uuid4()}",
            "action_type": "create_template",
            "section": "communications",
            "title": f"Create Template: {template_name}",
            "summary": f"Creates a {audience.lower()} email template for {campaign_name}.",
            "status": "ready",
            "assumptions": assumptions.copy(),
            "warnings": warnings.copy(),
            "payload": {
                "template_ref": template_ref,
                "template_key": template_key,
                "name": template_name,
                "audience": audience,
                "subject_template": subject_template,
                "body_template": body_template,
                "is_active": True,
            },
            "apply_target": {"api": "communication_template.create", "method": "POST"},
        },
        assumptions,
        warnings,
        template_ref,
    )


def _build_communication_schedule_from_template_ref(
    prompt: str,
    *,
    campaign_year: int,
    template_ref: str,
    template_name: str,
    milestone_catalog: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[str], list[str]]:
    milestone = _match_milestone_definition(prompt, milestone_catalog)
    timing = _extract_date_time(prompt, default_year=campaign_year)
    if milestone is None and timing["date_key"] is None:
        raise ServiceError(
            "Include either a milestone reference or a concrete send date so AI can place the communication on the calendar.",
            status_code=400,
            details={"field": "prompt"},
        )

    warnings = [
        "This drafts a planned calendar communication only. Automated delivery is not wired yet."
    ]

    summary = (
        f"Places {template_name} at {milestone['label']}"
        if milestone is not None
        else f"Places {template_name} on {timing['date_key']}"
    )

    return (
        {
            "id": f"draft-communication-{uuid.uuid4()}",
            "action_type": "create_communication_schedule",
            "section": "communications",
            "title": f"Schedule Communication: {template_name}",
            "summary": summary,
            "status": "ready",
            "assumptions": [],
            "warnings": warnings.copy(),
            "payload": {
                "template_id": None,
                "template_ref": template_ref,
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
        [],
        warnings,
    )


def _build_actions_for_readiness_item(
    item: Mapping[str, Any],
    *,
    campaign,
    milestones: list[Any],
    templates: list[Any],
    milestone_catalog: list[dict[str, Any]],
    readiness_context: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    code = str(item["code"])
    assumptions: list[str] = []
    warnings: list[str] = []
    actions: list[dict[str, Any]] = []

    if code == "missing_description":
        actions.append(
            _build_campaign_settings_update_action(
                {
                    "name": campaign.name,
                    "year": campaign.year,
                    "description": (
                        f"{campaign.name} coordinates teams, communications, and fulfillment for the {campaign.year} campaign year."
                    ),
                    "status": campaign.status,
                    "start_date": campaign.start_date.isoformat() if campaign.start_date else None,
                    "end_date": campaign.end_date.isoformat() if campaign.end_date else None,
                },
                title="Update Campaign Settings",
                summary="Adds missing campaign metadata needed for readiness.",
                assumptions=[
                    "Drafted a generic campaign description from the current campaign name and year."
                ],
                warnings=[],
            )
        )
        return actions, assumptions, warnings

    if code == "missing_date_range":
        return (
            [
                _build_blocked_readiness_action(
                    item,
                    summary="Campaign dates are still missing, so readiness cannot place milestone or lifecycle fixes automatically.",
                    warning="Set the campaign start and end dates in Settings before asking Campaign AI to clear activation blockers automatically.",
                )
            ],
            assumptions,
            warnings,
        )

    if code == "missing_manager":
        return (
            [
                _build_blocked_readiness_action(
                    item,
                    summary="A campaign manager is still required before activation can be cleared.",
                    warning="Name a specific person to make manager, then use Team AI to create the member or assign the Campaign Manager app access role.",
                )
            ],
            assumptions,
            warnings,
        )

    if code == "missing_team_assignments":
        return (
            [
                _build_blocked_readiness_action(
                    item,
                    summary="The campaign still needs at least one non-manager team assignment.",
                    warning="Name a specific team or member so Campaign AI can draft the right Team bundle.",
                )
            ],
            assumptions,
            warnings,
        )

    if code == "missing_milestones":
        milestone_keys = [str(key) for key in item.get("details", {}).get("missing_keys", [])]
        if not campaign.start_date or not campaign.end_date:
            return (
                [
                    _build_blocked_readiness_action(
                        item,
                        summary="Required milestone dates are missing, but the campaign date range is not available yet.",
                        warning="Set the campaign start and end dates first so Campaign AI can infer milestone timing.",
                    )
                ],
                assumptions,
                warnings,
            )

        inferred_dates = _infer_required_milestone_dates(
            campaign.start_date,
            campaign.end_date,
            milestone_keys,
            milestone_catalog,
        )
        existing_by_key = {milestone.milestone_key: milestone for milestone in milestones}
        for key in milestone_keys:
            if key not in inferred_dates:
                continue
            definition = _definition_for_milestone_key(key, milestone_catalog)
            existing_notes = existing_by_key.get(key).notes if key in existing_by_key else None
            actions.append(
                {
                    "id": f"draft-readiness-milestone-{uuid.uuid4()}",
                    "action_type": "create_milestone",
                    "section": "schedule",
                    "title": f"Place Milestone: {definition['label']}",
                    "summary": f"Places {definition['label']} on the calendar to satisfy readiness.",
                    "status": "needs_review",
                    "assumptions": [
                        "Inferred this milestone date by distributing required milestones across the campaign date range."
                    ],
                    "warnings": [],
                    "payload": {
                        "milestone_key": definition["key"],
                        "label": definition["label"],
                        "occurs_on": inferred_dates[key],
                        "notes": existing_notes or "Drafted from readiness fix plan.",
                        "sort_order": definition["sort_order"],
                    },
                    "apply_target": {"api": "campaign_milestone.replace", "method": "PUT"},
                }
            )
        return actions, assumptions, warnings

    if item.get("details", {}).get("rule_type") == "MISSING_MILESTONE":
        milestone_key = str(item.get("details", {}).get("milestone_key") or "")
        if not milestone_key:
            return (
                [
                    _build_blocked_readiness_action(
                        item,
                        summary="A configured milestone readiness rule is missing its milestone key.",
                        warning="Review the readiness rule configuration before Campaign AI can draft a milestone fix.",
                    )
                ],
                assumptions,
                warnings,
            )
        if not campaign.start_date or not campaign.end_date:
            return (
                [
                    _build_blocked_readiness_action(
                        item,
                        summary="A required milestone is missing, but the campaign date range is not available yet.",
                        warning="Set the campaign start and end dates first so Campaign AI can infer milestone timing.",
                    )
                ],
                assumptions,
                warnings,
            )
        inferred_dates = _infer_required_milestone_dates(
            campaign.start_date,
            campaign.end_date,
            [milestone_key],
            milestone_catalog,
        )
        definition = _definition_for_milestone_key(milestone_key, milestone_catalog)
        actions.append(
            {
                "id": f"draft-readiness-milestone-{uuid.uuid4()}",
                "action_type": "create_milestone",
                "section": "schedule",
                "title": f"Place Milestone: {definition['label']}",
                "summary": f"Places {definition['label']} on the calendar to satisfy readiness.",
                "status": "needs_review",
                "assumptions": [
                    "Inferred this milestone date by using its configured position in the milestone catalog."
                ],
                "warnings": [],
                "payload": {
                    "milestone_key": definition["key"],
                    "label": definition["label"],
                    "occurs_on": inferred_dates.get(milestone_key, campaign.start_date.isoformat()),
                    "notes": "Drafted from readiness fix plan.",
                    "sort_order": definition["sort_order"],
                },
                "apply_target": {"api": "campaign_milestone.replace", "method": "PUT"},
            }
        )
        return actions, assumptions, warnings

    if code == "missing_manual_schedule":
        if not campaign.start_date:
            return (
                [
                    _build_blocked_readiness_action(
                        item,
                        summary="Manual planning events are missing, but the campaign start date is not available yet.",
                        warning="Set the campaign start date before Campaign AI can place planning events automatically.",
                    )
                ],
                assumptions,
                warnings,
            )

        kickoff_date = (campaign.start_date + timedelta(days=7)).isoformat()
        actions.append(
            {
                "id": f"draft-readiness-event-{uuid.uuid4()}",
                "action_type": "create_event",
                "section": "schedule",
                "title": "Create Event: Volunteer Orientation",
                "summary": "Adds a manual planning event to strengthen the campaign timeline.",
                "status": "needs_review",
                "assumptions": [
                    "Placed the event one week after campaign start as a practical first planning block."
                ],
                "warnings": [],
                "payload": {
                    "title": "Volunteer Orientation",
                    "event_type": "VOLUNTEER",
                    "start_at": f"{kickoff_date}T18:00",
                    "end_at": None,
                    "all_day": False,
                    "notes": "Drafted from readiness fix plan.",
                },
                "apply_target": {"api": "campaign_event.create", "method": "POST"},
            }
        )
        return actions, assumptions, warnings

    if code == "missing_templates":
        template_action, template_assumptions, template_warnings, template_ref = (
            _build_template_creation_action(
                "Create a general campaign update template",
                campaign_name=campaign.name,
                templates=templates,
            )
        )
        actions.append(template_action)
        assumptions.extend(template_assumptions)
        warnings.extend(template_warnings)
        readiness_context["created_template_ref"] = template_ref
        readiness_context["created_template_name"] = str(template_action["payload"]["name"])
        return actions, assumptions, warnings

    if code in {"missing_schedules", "missing_schedule_messaging"}:
        schedule_actions, schedule_assumptions, schedule_warnings = _build_readiness_schedule_actions(
            item,
            milestones=milestones,
            templates=templates,
            readiness_context=readiness_context,
        )
        actions.extend(schedule_actions)
        assumptions.extend(schedule_assumptions)
        warnings.extend(schedule_warnings)
        return actions, assumptions, warnings

    if code == "automation_delivery_unavailable":
        return (
            [
                _build_blocked_readiness_action(
                    item,
                    summary="The campaign still lacks automated delivery for scheduled communications.",
                    warning="Campaign AI can place planned communications on the calendar, but the worker/scheduler execution layer still needs to be built separately.",
                )
            ],
            assumptions,
            warnings,
        )

    if code == "campaign_in_draft":
        return (
            [
                _build_blocked_readiness_action(
                    item,
                    summary="The campaign is still in draft status.",
                    warning="Review readiness first, then change the campaign status in Settings when you are ready to activate it.",
                )
            ],
            assumptions,
            warnings,
        )

    return actions, assumptions, warnings


def _build_readiness_schedule_actions(
    item: Mapping[str, Any],
    *,
    milestones: list[Any],
    templates: list[Any],
    readiness_context: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    assumptions: list[str] = []
    warnings = [
        "This drafts planned calendar communications only. Automated delivery is not wired yet."
    ]
    actions: list[dict[str, Any]] = []
    milestone_keys = [str(key) for key in item.get("details", {}).get("missing_keys", [])]

    active_templates = [template for template in templates if template.is_active]
    template_id: str | None = None
    template_ref = readiness_context.get("created_template_ref")
    template_name = readiness_context.get("created_template_name")
    if active_templates:
        template_id = str(active_templates[0].id)
        template_name = active_templates[0].name
        assumptions.append(
            f"Used the first active template {active_templates[0].name} for readiness schedule placement."
        )
    elif template_ref:
        template_name = template_name or "Campaign Update"
    else:
        return (
            [
                _build_blocked_readiness_action(
                    item,
                    summary="Communication timing is still missing, but no template is available for scheduling yet.",
                    warning="Create or draft at least one template first so Campaign AI can place communication timing on the calendar.",
                )
            ],
            assumptions,
            warnings,
        )

    milestone_map = {
        milestone.milestone_key: milestone
        for milestone in milestones
        if milestone.occurs_on is not None
    }
    target_keys = milestone_keys or list(milestone_map.keys())[:1]
    if not target_keys:
        return (
            [
                _build_blocked_readiness_action(
                    item,
                    summary="Communication timing is still missing, but there are no dated milestones to anchor it to yet.",
                    warning="Place milestone dates first so Campaign AI can schedule communications against them.",
                )
            ],
            assumptions,
            warnings,
        )

    for key in target_keys:
        milestone = milestone_map.get(key)
        if milestone is None:
            continue
        actions.append(
            {
                "id": f"draft-readiness-communication-{uuid.uuid4()}",
                "action_type": "create_communication_schedule",
                "section": "communications",
                "title": f"Schedule Communication: {template_name}",
                "summary": f"Places {template_name} at {milestone.label}.",
                "status": "needs_review",
                "assumptions": assumptions.copy(),
                "warnings": warnings.copy(),
                "payload": {
                    "template_id": template_id,
                    "template_ref": template_ref if template_id is None else None,
                    "milestone_key": milestone.milestone_key,
                    "scheduled_for": None,
                    "status": "DRAFT",
                    "notes": "Drafted from readiness fix plan.",
                },
                "apply_target": {"api": "campaign_communication_schedule.create", "method": "POST"},
            }
        )
    if actions:
        readiness_context["created_schedule"] = True
    return actions, assumptions, warnings


def _build_team_action(
    *,
    campaign_name: str,
    team_name: str,
    team_ref: str,
) -> dict[str, Any]:
    return {
        "id": f"draft-team-{uuid.uuid4()}",
        "action_type": "create_team",
        "section": "team",
        "title": f"Create Team: {team_name}",
        "summary": f"Creates the {team_name} team in {campaign_name}.",
        "status": "ready",
        "assumptions": [],
        "warnings": [],
        "payload": {
            "team_ref": team_ref,
            "name": team_name,
            "description": None,
            "is_active": True,
        },
        "apply_target": {"api": "campaign_team.create", "method": "POST"},
    }


def _build_team_role_action(
    *,
    role_name: str,
    team_id: str | None,
    team_ref: str | None,
    role_ref: str,
    sort_order: int,
) -> dict[str, Any]:
    return {
        "id": f"draft-team-role-{uuid.uuid4()}",
        "action_type": "create_team_role",
        "section": "team",
        "title": f"Create Team Role: {role_name}",
        "summary": f"Adds the {role_name} role to the selected team.",
        "status": "ready",
        "assumptions": [],
        "warnings": [],
        "payload": {
            "team_id": team_id,
            "team_ref": team_ref,
            "role_ref": role_ref,
            "name": role_name,
            "description": None,
            "sort_order": sort_order,
            "is_active": True,
        },
        "apply_target": {"api": "campaign_team_role.create", "method": "POST"},
    }


def _build_member_action(
    *,
    member_name: str,
    member_ref: str,
) -> dict[str, Any]:
    return {
        "id": f"draft-member-{uuid.uuid4()}",
        "action_type": "create_member",
        "section": "team",
        "title": f"Create Member: {member_name}",
        "summary": f"Adds {member_name} to the campaign roster.",
        "status": "ready",
        "assumptions": [],
        "warnings": [],
        "payload": {
            "member_ref": member_ref,
            "display_name": member_name,
            "email": None,
            "phone": None,
            "notes": None,
            "member_type": "volunteer",
            "app_access_status": "none",
            "is_active": True,
        },
        "apply_target": {"api": "campaign_member.create", "method": "POST"},
    }


def _build_member_assignment_action(
    *,
    member_name: str,
    team_name: str,
    team_id: str | None,
    team_ref: str | None,
    member_id: str | None,
    member_ref: str | None,
    team_role_id: str | None,
    team_role_ref: str | None,
    team_role_name: str | None,
) -> dict[str, Any]:
    summary = (
        f"Assigns {member_name} to {team_name} as {team_role_name}."
        if team_role_name
        else f"Assigns {member_name} to {team_name} as a team member."
    )
    return {
        "id": f"draft-team-membership-{uuid.uuid4()}",
        "action_type": "assign_member_to_team",
        "section": "team",
        "title": f"Assign Member: {member_name}",
        "summary": summary,
        "status": "ready",
        "assumptions": [],
        "warnings": [],
        "payload": {
            "team_id": team_id,
            "team_ref": team_ref,
            "member_id": member_id,
            "member_ref": member_ref,
            "team_role_id": team_role_id,
            "team_role_ref": team_role_ref,
        },
        "apply_target": {"api": "campaign_team_member.create", "method": "POST"},
    }


def _build_campaign_settings_update_action(
    payload: Mapping[str, Any],
    *,
    title: str,
    summary: str,
    assumptions: list[str],
    warnings: list[str],
) -> dict[str, Any]:
    return {
        "id": f"draft-campaign-settings-{uuid.uuid4()}",
        "action_type": "update_campaign_settings",
        "section": "settings",
        "title": title,
        "summary": summary,
        "status": "needs_review",
        "assumptions": assumptions.copy(),
        "warnings": warnings.copy(),
        "payload": {
            "name": payload["name"],
            "year": payload["year"],
            "description": payload["description"],
            "status": payload["status"],
            "start_date": payload["start_date"],
            "end_date": payload["end_date"],
        },
        "apply_target": {"api": "campaign.update", "method": "PATCH"},
    }


def _build_status_change_action(
    campaign,
    *,
    readiness: Mapping[str, Any],
    next_payload: Mapping[str, Any],
    target_status: str,
    is_app_admin: bool,
) -> dict[str, Any]:
    phase_key = _status_phase_key(target_status)
    blocking_warnings: list[str] = []
    status = "needs_review"

    if target_status == campaign.status:
        status = "blocked"
        blocking_warnings.append(f"{campaign.name} is already {campaign.status}.")
    else:
        try:
            validate_status_transition(campaign.status, target_status, is_app_admin=is_app_admin)
        except ServiceError:
            status = "blocked"
            blocking_warnings.append(
                f"The transition from {campaign.status} to {target_status} is not allowed for your current campaign role."
            )

    if phase_key is not None:
        phase_status = str(readiness.get("phase_status", {}).get(phase_key, "READY")).upper()
        if phase_status != "READY":
            status = "blocked"
            if phase_key == "activate":
                blocking_warnings.append(
                    "Review readiness first, then change the campaign status in Settings when activation is ready."
                )
            elif phase_key == "close":
                blocking_warnings.append(
                    "Operational closure checks still need attention before Campaign AI recommends closing this campaign."
                )

    return {
        "id": f"draft-campaign-status-{uuid.uuid4()}",
        "action_type": "suggest_status_change",
        "section": "settings",
        "title": f"Change Campaign Status: {target_status}",
        "summary": (
            f"Moves the campaign from {campaign.status} to {target_status}."
            if target_status != campaign.status
            else f"Keeps the campaign at {target_status}."
        ),
        "status": status,
        "assumptions": []
        if target_status == campaign.status
        else [f"Kept the current campaign settings and drafted only the lifecycle move to {target_status}."],
        "warnings": blocking_warnings,
        "payload": {
            "name": next_payload["name"],
            "year": next_payload["year"],
            "description": next_payload["description"],
            "status": target_status,
            "start_date": next_payload["start_date"],
            "end_date": next_payload["end_date"],
        },
        "apply_target": {"api": "campaign.update", "method": "PATCH"},
    }


def _campaign_settings_payload(campaign) -> dict[str, Any]:
    return {
        "name": campaign.name,
        "year": campaign.year,
        "description": campaign.description,
        "status": campaign.status,
        "start_date": campaign.start_date.isoformat() if campaign.start_date else None,
        "end_date": campaign.end_date.isoformat() if campaign.end_date else None,
    }


def _build_settings_summary(changed_fields: list[str]) -> str:
    field_labels = {
        "name": "campaign name",
        "year": "campaign year",
        "description": "campaign description",
        "start_date": "start date",
        "end_date": "end date",
    }
    ordered = [field_labels[field] for field in changed_fields if field in field_labels]
    if not ordered:
        return "Updates the campaign settings."
    if len(ordered) == 1:
        return f"Updates the {ordered[0]}."
    if len(ordered) == 2:
        return f"Updates the {ordered[0]} and {ordered[1]}."
    return f"Updates the {', '.join(ordered[:-1])}, and {ordered[-1]}."


def _build_blocked_readiness_action(
    item: Mapping[str, Any],
    *,
    summary: str,
    warning: str,
) -> dict[str, Any]:
    return {
        "id": f"draft-readiness-{item['code']}-{uuid.uuid4()}",
        "action_type": "resolve_readiness_gap",
        "section": "readiness",
        "title": f"Resolve Readiness Gap: {item['code'].replace('_', ' ').title()}",
        "summary": summary,
        "status": "blocked",
        "assumptions": [],
        "warnings": [warning],
        "payload": {
            "code": item["code"],
            "section": item["section"],
            "blocking_for": item.get("blocking_for", []),
        },
        "apply_target": {"api": "readiness.fix_plan", "method": "POST"},
    }


def _with_runtime_warning(payload: dict[str, Any], warning: str | None) -> dict[str, Any]:
    if not warning:
        return payload
    warnings = [warning]
    warnings.extend(str(item) for item in payload.get("warnings", []) if str(item))
    payload["warnings"] = warnings
    return payload


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


def _infer_schedule_action_type(prompt: str, milestone_catalog: list[dict[str, Any]] | None = None) -> str:
    normalized = _normalize_text(prompt)
    if any(term in normalized for term in ("email", "template", "reminder", "communication")):
        return "communication"
    if _match_milestone_definition(prompt, milestone_catalog) is not None:
        return "milestone"
    return "event"


def _match_milestone_definition(
    prompt: str,
    milestone_catalog: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    normalized_prompt = _normalize_text(prompt)
    for definition in milestone_catalog or []:
        key = str(definition["key"])
        label = str(definition["label"])
        normalized_label = _normalize_text(label)
        if normalized_label in normalized_prompt or key.replace("_", " ") in normalized_prompt:
            return {
                "key": key,
                "label": label,
                "sort_order": int(definition.get("sort_order") or 0),
            }
    return None


def _definition_for_milestone_key(
    milestone_key: str,
    milestone_catalog: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    for definition in milestone_catalog or []:
        if definition["key"] == milestone_key:
            return dict(definition)
    return {
        "key": milestone_key,
        "label": milestone_key.replace("_", " ").title(),
        "sort_order": 0,
    }


def _milestone_catalog_from_definitions(definitions: list[Any]) -> list[dict[str, Any]]:
    return [
        {
            "key": definition.milestone_key,
            "label": definition.label,
            "sort_order": definition.default_sort_order,
        }
        for definition in definitions
    ]


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


def _extract_template_name(prompt: str, *, audience: str) -> str:
    quoted_match = re.search(r'"([^"]+)"', prompt)
    if quoted_match and quoted_match.group(1):
        return quoted_match.group(1).strip()

    normalized = prompt.lower()
    suffix = "Update"
    if "welcome" in normalized:
        suffix = "Welcome"
    elif "reminder" in normalized:
        suffix = "Reminder"
    elif "instruction" in normalized:
        suffix = "Instructions"
    elif "thank" in normalized:
        suffix = "Thank You"
    elif "pickup" in normalized:
        suffix = "Pickup Details"

    prefix = "Campaign"
    if audience != "GENERAL":
        prefix = audience.title()
    return f"{prefix} {suffix}"


def _extract_team_name(prompt: str) -> str | None:
    normalized = prompt.lower()
    defaults = [
        ("warehouse crew", "Warehouse Crew"),
        ("pickup team", "Pickup Team"),
        ("sponsor callers", "Sponsor Callers"),
        ("phone bank", "Phone Bank"),
        ("warehouse", "Warehouse Crew"),
        ("pickup", "Pickup Team"),
        ("sponsor", "Sponsor Callers"),
    ]
    for term, label in defaults:
        if term in normalized:
            return label

    quoted_match = re.search(r'"([^"]+)"', prompt)
    if quoted_match and any(term in normalized for term in ("team", "crew", "callers", "committee")):
        return quoted_match.group(1).strip()

    keyword_patterns = [
        r"\b(?:create|set up|build|add)\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z\s-]{2,}?)\s+(?:team|crew|group)\b",
        r"\bto\s+(?:the\s+)?([a-z][a-z\s-]{2,}?)\s+(?:team|crew|group)\b",
        r"\b([a-z][a-z\s-]{2,}?)\s+(?:team|crew|group)\b",
    ]
    for pattern in keyword_patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if match and match.group(1):
            return " ".join(part.capitalize() for part in match.group(1).strip().split())

    return None


def _extract_team_role_names(prompt: str) -> list[str]:
    normalized = prompt.lower()
    role_names: list[str] = []
    with_match = re.search(r"\bwith\s+(.+)$", prompt, flags=re.IGNORECASE)
    if with_match:
        role_clause = re.split(
            r"\b(?:add|assign|put|place)\b",
            with_match.group(1),
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]
        candidates = re.split(r",| and ", role_clause)
        for candidate in candidates:
            cleaned = re.sub(r"\broles?\b", "", candidate, flags=re.IGNORECASE).strip(" .")
            if not cleaned:
                continue
            role_names.append(_title_case_phrase(cleaned))

    for role in ("lead", "runner", "check-in", "sorter", "caller", "coordinator"):
        if role in normalized and not any(_normalize_text(role) == _normalize_text(name) for name in role_names):
            role_names.append(_title_case_phrase(role))

    deduped: list[str] = []
    seen: set[str] = set()
    for role_name in role_names:
        normalized_name = _normalize_text(role_name)
        if normalized_name in seen:
            continue
        seen.add(normalized_name)
        deduped.append(role_name)
    return deduped


def _extract_member_name(prompt: str) -> str | None:
    quoted_match = re.search(r'"([^"]+)"', prompt)
    if quoted_match and len(quoted_match.group(1).split()) >= 2:
        return quoted_match.group(1).strip()

    patterns = [
        r"\b(?:add|assign|put|place)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b",
        r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:to|on)\s+(?:the\s+)?[A-Za-z]",
    ]
    for pattern in patterns:
        match = re.search(pattern, prompt)
        if match and match.group(1):
            return match.group(1).strip()
    return None


def _extract_assignment_role_name(prompt: str, role_names: list[str]) -> str | None:
    if not role_names:
        return None

    as_match = re.search(r"\bas\s+([A-Za-z][A-Za-z\s-]+)$", prompt.strip())
    if not as_match or not as_match.group(1):
        return None

    requested_role = _normalize_text(as_match.group(1).strip(" ."))
    for role_name in role_names:
        if _normalize_text(role_name) == requested_role:
            return role_name
    return None


def _is_readiness_explanation_prompt(prompt: str) -> bool:
    normalized = _normalize_text(prompt)
    asks_for_fix = any(
        term in normalized
        for term in ("fix", "clear", "resolve", "unblock", "build", "add", "create")
    )
    asks_for_explanation = any(
        term in normalized
        for term in ("explain", "summarize", "what is", "what are", "tell me", "why")
    )
    return asks_for_explanation and not asks_for_fix


def _is_settings_explanation_prompt(prompt: str) -> bool:
    normalized = _normalize_text(prompt)
    asks_for_change = any(
        term in normalized
        for term in (
            "set ",
            "change ",
            "update ",
            "rename ",
            "activate",
            "close",
            "archive",
            "draft ",
        )
    )
    asks_for_explanation = any(
        term in normalized
        for term in ("explain", "what happens", "what does", "should i", "when should")
    )
    return asks_for_explanation and not asks_for_change


def _select_readiness_items_for_prompt(
    prompt: str,
    readiness: Mapping[str, Any],
) -> list[Mapping[str, Any]]:
    normalized = _normalize_text(prompt)
    items = list(readiness.get("items", []))
    if any(term in normalized for term in ("activate", "activation", "launch", "blocker", "unblock")):
        filtered = [
            item
            for item in items
            if "activate" in item.get("blocking_for", [])
            or item.get("category") in {"blockers", "launch_checks"}
        ]
        return filtered or items
    if "operation" in normalized:
        filtered = [
            item
            for item in items
            if "operations" in item.get("blocking_for", [])
            or item.get("category") == "operational_health"
        ]
        return filtered or items
    return items


def _infer_required_milestone_dates(
    start_date: date,
    end_date: date,
    milestone_keys: list[str],
    milestone_catalog: list[dict[str, Any]] | None = None,
) -> dict[str, str]:
    ordered_keys = [str(definition["key"]) for definition in milestone_catalog or []]
    total_steps = max(len(ordered_keys) - 1, 1)
    total_days = max((end_date - start_date).days, 0)
    inferred: dict[str, str] = {}
    for key in milestone_keys:
        if key not in ordered_keys:
            continue
        index = ordered_keys.index(key)
        offset_days = round(total_days * (index / total_steps)) if total_steps else 0
        inferred_date = start_date + timedelta(days=offset_days)
        inferred[key] = inferred_date.isoformat()
    return inferred


def _extract_campaign_name(prompt: str) -> str | None:
    if not re.search(r"\b(rename|call|name)\b", prompt, flags=re.IGNORECASE):
        return None
    quoted_match = re.search(r'"([^"]+)"', prompt)
    if quoted_match and quoted_match.group(1):
        return quoted_match.group(1).strip()
    return None


def _extract_campaign_year(prompt: str) -> int | None:
    if not re.search(r"\b(year|campaign)\b", prompt, flags=re.IGNORECASE):
        return None
    year_match = re.search(r"\b(20\d{2})\b", prompt)
    if not year_match:
        return None
    return int(year_match.group(1))


def _extract_campaign_description(
    prompt: str,
    *,
    campaign_name: str,
    campaign_year: int,
) -> str | None:
    if not re.search(r"\bdescription\b", prompt, flags=re.IGNORECASE):
        return None

    quoted_match = re.search(r"\bdescription(?:\s+to|\s+as|:)?\s*\"([^\"]+)\"", prompt, flags=re.IGNORECASE)
    if quoted_match and quoted_match.group(1):
        return quoted_match.group(1).strip()

    return f"{campaign_name} coordinates teams, communications, and fulfillment for the {campaign_year} campaign year."


def _extract_campaign_date_range(prompt: str, *, default_year: int) -> tuple[str | None, str | None] | None:
    ordered_dates = _extract_all_dates(prompt, default_year=default_year)
    if len(ordered_dates) < 2:
        return None
    return ordered_dates[0], ordered_dates[1]


def _extract_all_dates(prompt: str, *, default_year: int) -> list[str]:
    matches: list[tuple[int, str]] = []
    for match in re.finditer(r"\b(20\d{2}-\d{2}-\d{2})\b", prompt):
        matches.append((match.start(), match.group(1)))

    for match in re.finditer(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", prompt):
        month, day, year = match.group(1), match.group(2), match.group(3)
        matches.append((match.start(), f"{year}-{month.zfill(2)}-{day.zfill(2)}"))

    month_pattern = (
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december)"
        r"\s+(\d{1,2})(?:,\s*(20\d{2}))?\b"
    )
    for match in re.finditer(month_pattern, prompt, flags=re.IGNORECASE):
        month_name = match.group(1).lower()
        day = match.group(2)
        year = match.group(3) or str(default_year)
        month_index = _MONTH_NAMES.index(month_name) + 1
        matches.append((match.start(), f"{year}-{str(month_index).zfill(2)}-{day.zfill(2)}"))

    matches.sort(key=lambda item: item[0])
    ordered_dates: list[str] = []
    seen: set[str] = set()
    for _, date_key in matches:
        if date_key in seen:
            continue
        seen.add(date_key)
        ordered_dates.append(date_key)
    return ordered_dates


def _extract_campaign_status_target(prompt: str) -> str | None:
    normalized = _normalize_text(prompt)
    if any(term in normalized for term in ("archive", "archived")):
        return "ARCHIVED"
    if any(term in normalized for term in ("close", "closed")):
        return "CLOSED"
    if any(term in normalized for term in ("activate", "active", "go live", "launch")):
        return "ACTIVE"
    if "draft" in normalized:
        return "DRAFT"
    return None


def _status_phase_key(target_status: str) -> str | None:
    if target_status == "ACTIVE":
        return "activate"
    if target_status == "CLOSED":
        return "close"
    return None


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


def _detect_template_audience(prompt: str) -> str:
    normalized = prompt.lower()
    if "sponsor" in normalized:
        return "SPONSOR"
    if "volunteer" in normalized:
        return "VOLUNTEER"
    if "manager" in normalized or "leader" in normalized:
        return "MANAGER"
    if any(term in normalized for term in ("parent", "guardian", "household", "family")):
        return "HOUSEHOLD_CONTACT"
    if any(term in normalized for term in ("facility", "resident", "nursing home", "care facility", "organization", "orphanage")):
        return "ORGANIZATION_CONTACT"
    if any(term in normalized for term in ("primary contact", "coordinator contact", "group contact")):
        return "GROUP_PRIMARY_CONTACT"
    if any(term in normalized for term in ("adult recipient", "recipient direct", "senior at home")):
        return "ADULT_RECIPIENT_DIRECT"
    if "recipient" in normalized:
        return "HOUSEHOLD_CONTACT"
    return "GENERAL"


def _is_team_explanation_prompt(prompt: str) -> bool:
    normalized = _normalize_text(prompt)
    return any(
        term in normalized
        for term in (
            "explain",
            "what is",
            "what does",
            "difference",
            "mean",
        )
    )


def _match_workspace_team(team_name: str, teams: list[Any]) -> dict[str, Any] | None:
    normalized_name = _normalize_text(team_name)
    for team in teams:
        if _normalize_text(str(_read_value(team, "name"))) == normalized_name:
            return team
    return None


def _match_workspace_member(member_name: str, members: list[Any]) -> dict[str, Any] | None:
    normalized_name = _normalize_text(member_name)
    for member in members:
        display_name = _read_value(member, "display_name", fallback_key="display_name")
        if _normalize_text(str(display_name)) == normalized_name:
            return member
    return None


def _match_team_role(role_name: str, roles: list[Any]) -> dict[str, Any] | None:
    normalized_name = _normalize_text(role_name)
    for role in roles:
        if _normalize_text(str(_read_value(role, "name"))) == normalized_name:
            return role
    return None


def _title_case_phrase(value: str) -> str:
    parts = re.split(r"[\s-]+", value.strip())
    if not parts:
        return value.strip()
    return " ".join(part.capitalize() for part in parts if part)


def _read_value(value: Any, key: str, *, default: Any = None, fallback_key: str | None = None) -> Any:
    if isinstance(value, Mapping):
        if key in value:
            return value[key]
        if fallback_key and fallback_key in value:
            return value[fallback_key]
        return default

    if hasattr(value, key):
        return getattr(value, key)
    if fallback_key and hasattr(value, fallback_key):
        return getattr(value, fallback_key)
    return default


def _communications_request_includes_schedule(
    prompt: str,
    *,
    campaign_year: int,
    milestone_catalog: list[dict[str, Any]] | None = None,
) -> bool:
    normalized = _normalize_text(prompt)
    if _match_milestone_definition(prompt, milestone_catalog) is not None:
        return True
    if _extract_date_time(prompt, default_year=campaign_year)["date_key"] is not None:
        return True
    return any(term in normalized for term in ("schedule", "calendar", "send on", "place on"))


def _derive_unique_template_key(name: str, templates: list[Any]) -> str:
    base = _slugify_template_key(name)
    existing_keys = {template.template_key for template in templates}
    if base not in existing_keys:
        return base

    suffix = 2
    while f"{base}_{suffix}" in existing_keys:
        suffix += 1
    return f"{base}_{suffix}"


def _slugify_template_key(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug[:100] or "campaign_template"


def _build_template_subject(prompt: str, template_name: str) -> str:
    quoted_match = re.search(r"subject\s*[:=-]\s*\"([^\"]+)\"", prompt, flags=re.IGNORECASE)
    if quoted_match and quoted_match.group(1):
        return quoted_match.group(1).strip()

    normalized = prompt.lower()
    if "welcome" in normalized:
        return "Welcome to {{campaign.name}}"
    if "reminder" in normalized:
        return "Reminder from {{campaign.name}}"
    if "pickup" in normalized:
        return "Pickup details for {{campaign.name}}"
    if "thank" in normalized:
        return "Thank you from {{campaign.name}}"
    return f"{template_name} | {{{{campaign.name}}}}"


def _build_template_body(
    prompt: str,
    *,
    audience: str,
) -> str:
    greeting_field = {
        "SPONSOR": "{{sponsor.first_name}}",
        "VOLUNTEER": "{{volunteer.first_name}}",
        "MANAGER": "{{manager.name}}",
        "HOUSEHOLD_CONTACT": "{{contact.first_name}}",
        "ORGANIZATION_CONTACT": "{{contact.first_name}}",
        "GROUP_PRIMARY_CONTACT": "{{contact.first_name}}",
        "ADULT_RECIPIENT_DIRECT": "{{recipient.first_name}}",
        "GENERAL": "there",
    }[audience]

    purpose_sentence = _build_template_purpose_sentence(prompt, audience)
    return "\n\n".join(
        [
            f"Hello {greeting_field},",
            purpose_sentence,
            "Please review the details for {{campaign.name}} and let us know if you have any questions.",
            "Thank you,\n{{organization.name}}",
        ]
    )


def _build_template_purpose_sentence(prompt: str, audience: str) -> str:
    normalized = prompt.lower()
    if "welcome" in normalized:
        return (
            "Welcome to {{campaign.name}}. "
            f"We are glad to have you involved in this {audience.lower()} effort."
        )
    if "reminder" in normalized:
        return "This is a reminder about the next step for {{campaign.name}}."
    if "pickup" in normalized:
        return "Here are the key pickup details and timing for {{campaign.name}}."
    if "thank" in normalized:
        return "Thank you for supporting {{campaign.name}}."
    return "Here is an update related to {{campaign.name}}."


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
