from __future__ import annotations

from datetime import datetime
from typing import Any

from app.features.campaigns.studio_serializers import serialize_directory_user
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember
from app.models.campaign_team_role import CampaignTeamRole


def serialize_campaign_member_access_role(
    assignment: CampaignMemberAccessRole,
) -> dict[str, Any]:
    return {
        "id": str(assignment.id),
        "campaign_member_id": str(assignment.campaign_member_id),
        "role_key": assignment.role_key,
        "is_active": bool(assignment.is_active),
        "created_at": _serialize_datetime(assignment.created_at),
        "updated_at": _serialize_datetime(assignment.updated_at),
    }


def serialize_campaign_team_role(role: CampaignTeamRole) -> dict[str, Any]:
    return {
        "id": str(role.id),
        "team_id": str(role.team_id),
        "name": role.name,
        "description": role.description,
        "sort_order": role.sort_order,
        "is_active": bool(role.is_active),
        "created_at": _serialize_datetime(role.created_at),
        "updated_at": _serialize_datetime(role.updated_at),
    }


def serialize_campaign_team_membership(
    membership: CampaignTeamMember,
) -> dict[str, Any]:
    return {
        "id": str(membership.id),
        "team_id": str(membership.team_id),
        "campaign_member_id": str(membership.campaign_member_id),
        "team_role_id": str(membership.team_role_id) if membership.team_role_id else None,
        "team_role": (
            serialize_campaign_team_role(membership.team_role)
            if membership.team_role is not None
            else None
        ),
        "created_at": _serialize_datetime(membership.created_at),
        "updated_at": _serialize_datetime(membership.updated_at),
    }


def serialize_campaign_team(team: CampaignTeam) -> dict[str, Any]:
    memberships = list(team.memberships or [])
    return {
        "id": str(team.id),
        "campaign_id": str(team.campaign_id),
        "name": team.name,
        "description": team.description,
        "is_active": bool(team.is_active),
        "member_count": len(memberships),
        "roles": [serialize_campaign_team_role(role) for role in list(team.roles or [])],
        "memberships": [serialize_campaign_team_membership(membership) for membership in memberships],
        "created_at": _serialize_datetime(team.created_at),
        "updated_at": _serialize_datetime(team.updated_at),
    }


def serialize_campaign_member(member: CampaignMember) -> dict[str, Any]:
    access_roles = list(member.access_roles or [])
    team_memberships = list(member.team_memberships or [])
    return {
        "id": str(member.id),
        "campaign_id": str(member.campaign_id),
        "display_name": member.display_name,
        "email": member.email,
        "phone": member.phone,
        "notes": member.notes,
        "member_type": member.member_type,
        "app_user_id": str(member.app_user_id) if member.app_user_id else None,
        "app_access_status": member.app_access_status,
        "is_active": bool(member.is_active),
        "app_user": {
            "id": str(member.app_user.id),
            "email": member.app_user.email,
            "display_name": member.app_user.display_name,
            "app_role": member.app_user.role,
            "is_active": bool(member.app_user.is_active),
        }
        if member.app_user is not None
        else None,
        "access_roles": [
            serialize_campaign_member_access_role(assignment) for assignment in access_roles
        ],
        "teams": [
            {
                "id": str(membership.team.id),
                "name": membership.team.name,
                "is_active": bool(membership.team.is_active),
                "team_role_id": (
                    str(membership.team_role_id) if membership.team_role_id else None
                ),
                "team_role_name": (
                    membership.team_role.name
                    if membership.team_role is not None
                    else None
                ),
            }
            for membership in team_memberships
            if membership.team is not None
        ],
        "team_memberships": [
            serialize_campaign_team_membership(membership) for membership in team_memberships
        ],
        "created_at": _serialize_datetime(member.created_at),
        "updated_at": _serialize_datetime(member.updated_at),
    }


def serialize_team_workspace(
    *,
    campaign_id: str,
    counts: dict[str, int],
    members: list[CampaignMember],
    teams: list[CampaignTeam],
    access_roles: list[CampaignMemberAccessRole],
    directory_users: list[dict[str, Any]],
    role_catalog: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "counts": counts,
        "members": [serialize_campaign_member(member) for member in members],
        "teams": [serialize_campaign_team(team) for team in teams],
        "access_roles": [
            serialize_campaign_member_access_role(assignment) for assignment in access_roles
        ],
        "directory_users": [serialize_directory_user(user) for user in directory_users],
        "role_catalog": role_catalog,
        "filters": {
            "role_keys": sorted({assignment.role_key for assignment in access_roles}),
            "teams": [
                {
                    "id": str(team.id),
                    "name": team.name,
                    "is_active": bool(team.is_active),
                    "member_count": len(team.memberships or []),
                }
                for team in teams
            ],
            "member_types": sorted({member.member_type for member in members}),
            "app_access_statuses": sorted({member.app_access_status for member in members}),
        },
    }


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
