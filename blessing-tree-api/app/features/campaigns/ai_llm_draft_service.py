from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.admin.llm_runtime_service import (
    AdminLlmRuntimeService,
    LlmRuntimeUnavailableError,
)
from app.features.campaigns.ai_llm_action_normalizer import normalize_llm_draft
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.campaigns.team_workspace_service import CampaignTeamWorkspaceService
from app.features.rbac.constants import CAMPAIGN_ROLE_CATALOG

SECTION_ACTIONS: dict[str, tuple[str, ...]] = {
    "schedule": ("create_event", "create_milestone", "create_communication_schedule"),
    "communications": ("create_template", "create_communication_schedule"),
    "team": ("create_team", "create_team_role", "create_member", "assign_member_to_team"),
    "readiness": (
        "create_event",
        "create_milestone",
        "create_template",
        "create_communication_schedule",
        "update_campaign_settings",
        "suggest_status_change",
    ),
    "settings": ("update_campaign_settings", "suggest_status_change"),
}


class CampaignStudioLlmDraftService:
    def __init__(
        self,
        *,
        runtime: AdminLlmRuntimeService | None = None,
        campaigns: CampaignService | None = None,
        studio: CampaignStudioService | None = None,
        team_workspace: CampaignTeamWorkspaceService | None = None,
    ) -> None:
        self.runtime = runtime or AdminLlmRuntimeService()
        self.campaigns = campaigns or CampaignService()
        self.studio = studio or CampaignStudioService(self.campaigns)
        self.team_workspace = team_workspace or CampaignTeamWorkspaceService(self.campaigns)

    def draft_or_none(
        self,
        db: Session,
        *,
        user_id: str,
        campaign_id: str,
        campaign,
        section: str,
        prompt: str,
        requested_action_type: str | None,
    ) -> tuple[dict[str, Any] | None, str | None]:
        allowed_actions = SECTION_ACTIONS.get(section)
        if allowed_actions is None:
            return None, None

        try:
            payload = self.runtime.draft_json(
                db,
                system_prompt=self._build_system_prompt(),
                user_prompt=self._build_user_prompt(
                    db,
                    user_id=user_id,
                    campaign_id=campaign_id,
                    campaign=campaign,
                    section=section,
                    prompt=prompt,
                    requested_action_type=requested_action_type,
                    allowed_actions=allowed_actions,
                ),
            )
        except LlmRuntimeUnavailableError as exc:
            return None, str(exc)

        if payload is None:
            return None, None

        try:
            workspace = (
                self.team_workspace.get_workspace_payload(db, campaign_id)
                if section in {"team", "readiness"}
                else {"teams": [], "members": []}
            )
            readiness = self.studio.get_readiness(db, campaign_id) if section in {"settings", "readiness"} else {}
            access = (
                self.campaigns.get_campaign_access_payload(db, user_id, campaign_id)
                if section in {"settings", "readiness"}
                else {}
            )
            return (
                normalize_llm_draft(
                    payload,
                    section=section,
                    allowed_actions=allowed_actions,
                    campaign=campaign,
                    templates=self.studio.list_templates(db, campaign_id),
                    milestones=self.studio.list_milestones(db, campaign_id),
                    milestone_definitions=self.studio.milestone_definitions.list_active_definitions(db),
                    teams=workspace["teams"],
                    members=workspace["members"],
                    readiness=readiness,
                    is_app_admin=str(access.get("global_app_role")) == "APP_ADMIN",
                ),
                None,
            )
        except (ServiceError, ValueError, TypeError, KeyError) as exc:
            return None, f"Configured LLM returned an invalid draft, so Campaign AI used deterministic fallback. {exc}"

    @staticmethod
    def _build_system_prompt() -> str:
        return (
            "You are Blessing Tree Campaign Studio AI. "
            "Return JSON only. "
            'Schema: {"message": string, "assumptions": string[], "warnings": string[], '
            '"actions": [{"action_type": string, "payload": object}]}. '
            "Only use allowed action types from context.allowed_actions. "
            "Prefer fewer, concrete actions over broad speculation. "
            "Never create update_template actions. If the user seems to want to modify an existing template, "
            "return a warning and no action unless the request clearly asks to create a new template instead. "
            "For create_template, always include payload.name, payload.subject_template, and payload.body_template. "
            "For create_communication_schedule, this is calendar planning only, not guaranteed delivery execution. "
            "Use milestone keys from context.milestone_catalog when possible. "
            "For assign_member_to_team, team_role_name is optional and can be omitted to mean plain Member participation."
        )

    def _build_user_prompt(
        self,
        db: Session,
        *,
        user_id: str,
        campaign_id: str,
        campaign,
        section: str,
        prompt: str,
        requested_action_type: str | None,
        allowed_actions: tuple[str, ...],
    ) -> str:
        context: dict[str, Any] = {
            "campaign": {
                "name": campaign.name,
                "year": campaign.year,
                "description": campaign.description,
                "status": campaign.status,
                "start_date": campaign.start_date.isoformat() if campaign.start_date else None,
                "end_date": campaign.end_date.isoformat() if campaign.end_date else None,
            },
            "allowed_actions": list(allowed_actions),
            "requested_action_type": requested_action_type,
            "milestone_catalog": [
                {
                    "key": definition.milestone_key,
                    "label": definition.label,
                    "sort_order": definition.default_sort_order,
                }
                for definition in self.studio.milestone_definitions.list_active_definitions(db)
            ],
            "role_catalog": [{"role_key": role["role_key"], "label": role["label"]} for role in CAMPAIGN_ROLE_CATALOG],
        }
        if section in {"schedule", "communications", "readiness"}:
            context["templates"] = [
                {
                    "name": template.name,
                    "template_key": template.template_key,
                    "audience": template.audience,
                    "is_active": bool(template.is_active),
                }
                for template in self.studio.list_templates(db, campaign_id)
            ]
            context["milestones"] = [
                {
                    "key": milestone.milestone_key,
                    "label": milestone.label,
                    "occurs_on": milestone.occurs_on.isoformat() if milestone.occurs_on else None,
                }
                for milestone in self.studio.list_milestones(db, campaign_id)
            ]
        if section in {"team", "readiness"}:
            workspace = self.team_workspace.get_workspace_payload(db, campaign_id)
            context["teams"] = [
                {
                    "name": team.name,
                    "roles": [role.name for role in team.roles],
                    "members": [membership.campaign_member.display_name for membership in team.memberships],
                }
                for team in workspace["teams"]
            ]
            context["members"] = [
                {
                    "display_name": member.display_name,
                    "member_type": member.member_type,
                    "app_access_status": member.app_access_status,
                }
                for member in workspace["members"]
            ]
        if section in {"settings", "readiness"}:
            context["readiness"] = self.studio.get_readiness(db, campaign_id)
            context["access"] = self.campaigns.get_campaign_access_payload(db, user_id, campaign_id)
        return f"Context:\n{context}\n\nUser request:\n{prompt}"
