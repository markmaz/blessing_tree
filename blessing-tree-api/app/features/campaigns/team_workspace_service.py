from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.features.campaigns.member_service import CampaignMemberService
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_team_service import CampaignStudioTeamService
from app.features.campaigns.team_service import CampaignTeamService
from app.features.rbac.constants import CAMPAIGN_MANAGER_ROLE


class CampaignTeamWorkspaceService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.members = CampaignMemberService(self.campaigns)
        self.teams = CampaignTeamService(self.campaigns)
        self.directory = CampaignStudioTeamService(self.campaigns)

    def get_workspace_payload(self, db: Session, campaign_id: str) -> dict[str, object]:
        members = self.members.list_members(db, campaign_id)
        teams = self.teams.list_teams(db, campaign_id)
        access_roles = self.members.list_access_roles(db, campaign_id)
        directory_users = self.directory.search_directory_users(db, campaign_id, limit=25)
        counts = self._build_counts(members, teams, access_roles)
        return {
            "campaign_id": campaign_id,
            "counts": counts,
            "members": members,
            "teams": teams,
            "access_roles": access_roles,
            "directory_users": directory_users,
        }

    @staticmethod
    def _build_counts(members, teams, access_roles) -> dict[str, int]:
        active_members = [member for member in members if member.is_active]
        role_counts = Counter(
            assignment.role_key
            for assignment in access_roles
            if assignment.is_active
        )
        return {
            "member_count": len(members),
            "active_member_count": len(active_members),
            "members_with_app_access_count": sum(
                1 for member in active_members if member.app_access_status != "none"
            ),
            "active_assignment_count": sum(1 for assignment in access_roles if assignment.is_active),
            "manager_count": role_counts.get(CAMPAIGN_MANAGER_ROLE, 0),
            "team_count": len(teams),
        }
