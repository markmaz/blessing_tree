from __future__ import annotations

import uuid

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.admin.audit_service import AuditEventService, build_changes
from app.features.campaigns import campaign_ns
from app.features.campaigns.member_service import CampaignMemberService
from app.features.campaigns.team_serializers import (
    serialize_campaign_member,
    serialize_campaign_member_access_role,
    serialize_campaign_team,
    serialize_campaign_team_membership,
    serialize_campaign_team_role,
    serialize_team_workspace,
)
from app.features.campaigns.team_workspace_service import CampaignTeamWorkspaceService
from app.features.campaigns.team_service import CampaignTeamService
from app.features.campaigns.team_validation import parse_bool
from app.features.rbac.decorators import require_campaign_capability
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember
from app.models.campaign_team_role import CampaignTeamRole

_member_service = CampaignMemberService()
_team_service = CampaignTeamService()
_team_workspace_service = CampaignTeamWorkspaceService()
_audit_event_service = AuditEventService()

MEMBER_FIELD_MAP = {
    "display_name": "Name",
    "email": "Email",
    "phone": "Phone",
    "notes": "Notes",
    "member_type": "Member Type",
    "app_user_id": "App User",
    "app_access_status": "App Access",
    "is_active": "Active",
}

ACCESS_ROLE_FIELD_MAP = {
    "role_key": "Access Role",
    "is_active": "Active",
}

TEAM_FIELD_MAP = {
    "name": "Name",
    "description": "Description",
    "is_active": "Active",
}

TEAM_ROLE_FIELD_MAP = {
    "name": "Name",
    "description": "Description",
    "sort_order": "Sort Order",
    "is_active": "Active",
}

MEMBERSHIP_FIELD_MAP = {
    "team_id": "Team",
    "campaign_member_id": "Member",
    "team_role_id": "Team Role",
}


@campaign_ns.route("/<string:campaign_id>/team-workspace")
class CampaignTeamWorkspaceResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _team_workspace_service.get_workspace_payload(db, campaign_id)
        return serialize_team_workspace(**payload)


@campaign_ns.route("/<string:campaign_id>/members")
class CampaignMemberListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            members = _member_service.list_members(
                db,
                campaign_id,
                search=request.args.get("search"),
                app_access_status=request.args.get("app_access_status"),
                role_key=request.args.get("role_key"),
                team_id=request.args.get("team_id"),
                is_active=_parse_optional_bool(request.args.get("is_active")),
            )
        return [serialize_campaign_member(member) for member in members]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            member = _member_service.create_member(db, campaign_id, payload)
            response = serialize_campaign_member(member)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="campaign_member",
                entity_id=member.id,
                entity_label=member.display_name,
                summary=f"Created campaign team member {member.display_name}.",
                changes=build_changes(before={}, after=_member_snapshot(member), field_map=MEMBER_FIELD_MAP),
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>")
class CampaignMemberDetailResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str, member_id: str):
        with SessionLocal() as db:
            member = _member_service.get_member(db, campaign_id, member_id)
        return serialize_campaign_member(member)

    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_member = _member_service.get_member(db, campaign_id, member_id)
            before = _member_snapshot(before_member)
            member = _member_service.update_member(db, campaign_id, member_id, payload)
            response = serialize_campaign_member(member)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="campaign_member",
                entity_id=member.id,
                entity_label=member.display_name,
                summary=f"Updated campaign team member {member.display_name}.",
                changes=build_changes(before=before, after=_member_snapshot(member), field_map=MEMBER_FIELD_MAP),
            )
        return response


@campaign_ns.route("/<string:campaign_id>/member-access-roles")
class CampaignMemberAccessRoleListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            assignments = _member_service.list_access_roles(db, campaign_id)
        return [serialize_campaign_member_access_role(assignment) for assignment in assignments]


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/access-roles")
class CampaignMemberAccessRoleCreateResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            assignment = _member_service.create_access_role(db, campaign_id, member_id, payload)
            response = serialize_campaign_member_access_role(assignment)
            label = _member_label(db, assignment.campaign_member_id)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="campaign_member_access_role",
                entity_id=assignment.id,
                entity_label=label,
                summary=f"Added {assignment.role_key} access for {label}.",
                changes=build_changes(before={}, after=_access_role_snapshot(assignment), field_map=ACCESS_ROLE_FIELD_MAP),
                metadata={"campaign_member_id": str(assignment.campaign_member_id)},
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/access-roles/<string:assignment_id>")
class CampaignMemberAccessRoleDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, member_id: str, assignment_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            member = _member_service.get_member(db, campaign_id, member_id)
            before_assignment = _find_access_role(db, member.id, assignment_id)
            before = _access_role_snapshot(before_assignment) if before_assignment is not None else {}
            assignment = _member_service.update_access_role(
                db,
                campaign_id,
                member_id,
                assignment_id,
                payload,
            )
            response = serialize_campaign_member_access_role(assignment)
            label = _member_label(db, assignment.campaign_member_id)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="campaign_member_access_role",
                entity_id=assignment.id,
                entity_label=label,
                summary=f"Updated access for {label}.",
                changes=build_changes(before=before, after=_access_role_snapshot(assignment), field_map=ACCESS_ROLE_FIELD_MAP),
                metadata={"campaign_member_id": str(assignment.campaign_member_id)},
            )
        return response


@campaign_ns.route("/<string:campaign_id>/teams")
class CampaignTeamListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            teams = _team_service.list_teams(db, campaign_id)
        return [serialize_campaign_team(team) for team in teams]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            team = _team_service.create_team(db, campaign_id, payload)
            response = serialize_campaign_team(team)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="campaign_team",
                entity_id=team.id,
                entity_label=team.name,
                summary=f"Created team {team.name}.",
                changes=build_changes(before={}, after=_team_snapshot(team), field_map=TEAM_FIELD_MAP),
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>")
class CampaignTeamDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, team_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_team = _find_team(db, campaign_id, team_id)
            before = _team_snapshot(before_team) if before_team is not None else {}
            team = _team_service.update_team(db, campaign_id, team_id, payload)
            response = serialize_campaign_team(team)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="campaign_team",
                entity_id=team.id,
                entity_label=team.name,
                summary=f"Updated team {team.name}.",
                changes=build_changes(before=before, after=_team_snapshot(team), field_map=TEAM_FIELD_MAP),
            )
        return response


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>/roles")
class CampaignTeamRoleListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str, team_id: str):
        with SessionLocal() as db:
            roles = _team_service.list_roles(db, campaign_id, team_id)
        return [serialize_campaign_team_role(role) for role in roles]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, team_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            role = _team_service.create_role(db, campaign_id, team_id, payload)
            response = serialize_campaign_team_role(role)
            team = _find_team(db, campaign_id, team_id)
            team_name = team.name if team is not None else "team"
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="campaign_team_role",
                entity_id=role.id,
                entity_label=role.name,
                summary=f"Created role {role.name} on {team_name}.",
                changes=build_changes(before={}, after=_team_role_snapshot(role), field_map=TEAM_ROLE_FIELD_MAP),
                metadata={"team_id": str(role.team_id)},
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>/roles/<string:role_id>")
class CampaignTeamRoleDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, team_id: str, role_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_role = _find_team_role(db, team_id, role_id)
            before = _team_role_snapshot(before_role) if before_role is not None else {}
            role = _team_service.update_role(db, campaign_id, team_id, role_id, payload)
            response = serialize_campaign_team_role(role)
            team = _find_team(db, campaign_id, team_id)
            team_name = team.name if team is not None else "team"
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="campaign_team_role",
                entity_id=role.id,
                entity_label=role.name,
                summary=f"Updated role {role.name} on {team_name}.",
                changes=build_changes(before=before, after=_team_role_snapshot(role), field_map=TEAM_ROLE_FIELD_MAP),
                metadata={"team_id": str(role.team_id)},
            )
        return response


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>/members")
class CampaignTeamMembershipCreateResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, team_id: str):
        payload = request.get_json(silent=True) or {}
        member_id = payload.get("member_id")
        team_role_id = payload.get("team_role_id")
        with SessionLocal() as db:
            membership = _team_service.add_member(
                db,
                campaign_id,
                team_id,
                str(member_id),
                None if team_role_id in (None, "") else str(team_role_id),
            )
            response = serialize_campaign_team_membership(membership)
            _record_membership_event(
                db,
                campaign_id=campaign_id,
                action="created",
                membership=membership,
                before={},
                summary=f"Added {_member_label(db, membership.campaign_member_id)} to {_team_label(db, membership.team_id)}.",
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>/members/<string:member_id>")
class CampaignTeamMembershipDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, team_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        team_role_id = payload.get("team_role_id")
        with SessionLocal() as db:
            before_membership = _find_membership(db, team_id, member_id)
            before = _membership_snapshot(before_membership) if before_membership is not None else {}
            membership = _team_service.update_member_role(
                db,
                campaign_id,
                team_id,
                member_id,
                None if team_role_id in (None, "") else str(team_role_id),
            )
            response = serialize_campaign_team_membership(membership)
            _record_membership_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                membership=membership,
                before=before,
                summary=f"Updated {_member_label(db, membership.campaign_member_id)} on {_team_label(db, membership.team_id)}.",
            )
        return response

    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, team_id: str, member_id: str):
        with SessionLocal() as db:
            before_membership = _find_membership(db, team_id, member_id)
            before = _membership_snapshot(before_membership) if before_membership is not None else {}
            member_label = _member_label(db, before_membership.campaign_member_id) if before_membership is not None else member_id
            team_label = _team_label(db, before_membership.team_id) if before_membership is not None else team_id
            membership_id = before_membership.id if before_membership is not None else None
            _team_service.remove_member(db, campaign_id, team_id, member_id)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="deleted",
                entity_type="campaign_team_member",
                entity_id=membership_id,
                entity_label=f"{member_label} on {team_label}",
                summary=f"Removed {member_label} from {team_label}.",
                changes=build_changes(before=before, after={}, field_map=MEMBERSHIP_FIELD_MAP),
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/link-app-user")
class CampaignMemberLinkAppUserResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_member = _member_service.get_member(db, campaign_id, member_id)
            before = _member_snapshot(before_member)
            member = _member_service.link_app_user(db, campaign_id, member_id, payload)
            response = serialize_campaign_member(member)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="campaign_member",
                entity_id=member.id,
                entity_label=member.display_name,
                summary=f"Linked app access for {member.display_name}.",
                changes=build_changes(before=before, after=_member_snapshot(member), field_map=MEMBER_FIELD_MAP),
            )
        return response


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/invite-app-access")
class CampaignMemberInviteAppAccessResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_member = _member_service.get_member(db, campaign_id, member_id)
            before = _member_snapshot(before_member)
            member = _member_service.invite_app_access(db, campaign_id, member_id, payload)
            response = serialize_campaign_member(member)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="campaign_member",
                entity_id=member.id,
                entity_label=member.display_name,
                summary=f"Invited {member.display_name} to app access.",
                changes=build_changes(before=before, after=_member_snapshot(member), field_map=MEMBER_FIELD_MAP),
            )
        return response


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/app-access")
class CampaignMemberAppAccessDeleteResource(Resource):
    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, member_id: str):
        with SessionLocal() as db:
            before_member = _member_service.get_member(db, campaign_id, member_id)
            before = _member_snapshot(before_member)
            member = _member_service.remove_app_access(db, campaign_id, member_id)
            response = serialize_campaign_member(member)
            _record_team_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="campaign_member",
                entity_id=member.id,
                entity_label=member.display_name,
                summary=f"Removed app access for {member.display_name}.",
                changes=build_changes(before=before, after=_member_snapshot(member), field_map=MEMBER_FIELD_MAP),
            )
        return response


def _parse_optional_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    return parse_bool(value, "is_active")


def _record_team_event(
    db,
    *,
    campaign_id: str,
    action: str,
    entity_type: str,
    summary: str,
    entity_id=None,
    entity_label: str | None = None,
    changes: list[dict[str, object]] | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    _audit_event_service.record_event(
        db,
        area="campaigns",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        campaign_id=campaign_id,
        actor_user_id=getattr(g, "user_id", None),
        summary=summary,
        changes=changes,
        metadata=metadata,
    )
    db.commit()


def _record_membership_event(db, *, campaign_id: str, action: str, membership, before: dict[str, object], summary: str) -> None:
    _record_team_event(
        db,
        campaign_id=campaign_id,
        action=action,
        entity_type="campaign_team_member",
        entity_id=membership.id,
        entity_label=f"{_member_label(db, membership.campaign_member_id)} on {_team_label(db, membership.team_id)}",
        summary=summary,
        changes=build_changes(before=before, after=_membership_snapshot(membership), field_map=MEMBERSHIP_FIELD_MAP),
    )


def _member_snapshot(member: CampaignMember) -> dict[str, object]:
    return {
        "display_name": member.display_name,
        "email": member.email,
        "phone": member.phone,
        "notes": member.notes,
        "member_type": member.member_type,
        "app_user_id": str(member.app_user_id) if member.app_user_id else None,
        "app_access_status": member.app_access_status,
        "is_active": bool(member.is_active),
    }


def _access_role_snapshot(assignment: CampaignMemberAccessRole) -> dict[str, object]:
    return {"role_key": assignment.role_key, "is_active": bool(assignment.is_active)}


def _team_snapshot(team: CampaignTeam) -> dict[str, object]:
    return {"name": team.name, "description": team.description, "is_active": bool(team.is_active)}


def _team_role_snapshot(role: CampaignTeamRole) -> dict[str, object]:
    return {
        "name": role.name,
        "description": role.description,
        "sort_order": role.sort_order,
        "is_active": bool(role.is_active),
    }


def _membership_snapshot(membership: CampaignTeamMember) -> dict[str, object]:
    return {
        "team_id": str(membership.team_id),
        "campaign_member_id": str(membership.campaign_member_id),
        "team_role_id": str(membership.team_role_id) if membership.team_role_id else None,
    }


def _member_label(db, member_id) -> str:
    member = db.get(CampaignMember, member_id)
    return member.display_name if member is not None else str(member_id)


def _team_label(db, team_id) -> str:
    team = db.get(CampaignTeam, team_id)
    return team.name if team is not None else str(team_id)


def _find_team(db, campaign_id: str, team_id: str) -> CampaignTeam | None:
    return (
        db.query(CampaignTeam)
        .filter(CampaignTeam.campaign_id == uuid.UUID(campaign_id), CampaignTeam.id == uuid.UUID(team_id))
        .one_or_none()
    )


def _find_team_role(db, team_id: str, role_id: str) -> CampaignTeamRole | None:
    return (
        db.query(CampaignTeamRole)
        .filter(CampaignTeamRole.team_id == uuid.UUID(team_id), CampaignTeamRole.id == uuid.UUID(role_id))
        .one_or_none()
    )


def _find_access_role(db, member_id, assignment_id: str) -> CampaignMemberAccessRole | None:
    return (
        db.query(CampaignMemberAccessRole)
        .filter(CampaignMemberAccessRole.campaign_member_id == member_id, CampaignMemberAccessRole.id == uuid.UUID(assignment_id))
        .one_or_none()
    )


def _find_membership(db, team_id: str, member_id: str) -> CampaignTeamMember | None:
    return (
        db.query(CampaignTeamMember)
        .filter(CampaignTeamMember.team_id == uuid.UUID(team_id), CampaignTeamMember.campaign_member_id == uuid.UUID(member_id))
        .one_or_none()
    )
