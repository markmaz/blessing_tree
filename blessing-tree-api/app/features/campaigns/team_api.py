from __future__ import annotations

from flask import request
from flask_restx import Resource

from app.db import SessionLocal
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

_member_service = CampaignMemberService()
_team_service = CampaignTeamService()
_team_workspace_service = CampaignTeamWorkspaceService()


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
        return serialize_campaign_member(member), 201


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
            member = _member_service.update_member(db, campaign_id, member_id, payload)
        return serialize_campaign_member(member)


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
        return serialize_campaign_member_access_role(assignment), 201


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/access-roles/<string:assignment_id>")
class CampaignMemberAccessRoleDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, member_id: str, assignment_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            assignment = _member_service.update_access_role(
                db,
                campaign_id,
                member_id,
                assignment_id,
                payload,
            )
        return serialize_campaign_member_access_role(assignment)


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
        return serialize_campaign_team(team), 201


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>")
class CampaignTeamDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, team_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            team = _team_service.update_team(db, campaign_id, team_id, payload)
        return serialize_campaign_team(team)


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
        return serialize_campaign_team_role(role), 201


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>/roles/<string:role_id>")
class CampaignTeamRoleDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, team_id: str, role_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            role = _team_service.update_role(db, campaign_id, team_id, role_id, payload)
        return serialize_campaign_team_role(role)


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
        return serialize_campaign_team_membership(membership), 201


@campaign_ns.route("/<string:campaign_id>/teams/<string:team_id>/members/<string:member_id>")
class CampaignTeamMembershipDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, team_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        team_role_id = payload.get("team_role_id")
        with SessionLocal() as db:
            membership = _team_service.update_member_role(
                db,
                campaign_id,
                team_id,
                member_id,
                None if team_role_id in (None, "") else str(team_role_id),
            )
        return serialize_campaign_team_membership(membership)

    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, team_id: str, member_id: str):
        with SessionLocal() as db:
            _team_service.remove_member(db, campaign_id, team_id, member_id)
        return "", 204


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/link-app-user")
class CampaignMemberLinkAppUserResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            member = _member_service.link_app_user(db, campaign_id, member_id, payload)
        return serialize_campaign_member(member)


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/invite-app-access")
class CampaignMemberInviteAppAccessResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, member_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            member = _member_service.invite_app_access(db, campaign_id, member_id, payload)
        return serialize_campaign_member(member)


@campaign_ns.route("/<string:campaign_id>/members/<string:member_id>/app-access")
class CampaignMemberAppAccessDeleteResource(Resource):
    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, member_id: str):
        with SessionLocal() as db:
            member = _member_service.remove_app_access(db, campaign_id, member_id)
        return serialize_campaign_member(member)


def _parse_optional_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    return parse_bool(value, "is_active")
