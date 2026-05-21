import type {
  CampaignDirectoryUserOption,
  CampaignMemberAccessRoleAssignment,
  CampaignTeamWorkspaceAppUser,
  CampaignTeamMemberUpsertInput,
  CampaignTeamWorkspaceData,
  CampaignTeamWorkspaceMember,
  CampaignTeamWorkspaceTeam,
  CampaignTeamWorkspaceTeamMembership,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

export interface CampaignTeamWorkspaceMembershipResponse {
  id: string;
  team_id: string;
  campaign_member_id: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface CampaignTeamWorkspaceAppUserResponse {
  id: string;
  email: string;
  display_name: string;
  app_role: string;
  is_active: boolean;
}

export interface CampaignMemberAccessRoleResponse {
  id: string;
  campaign_member_id: string;
  role_key: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CampaignTeamWorkspaceTeamSummaryResponse {
  id: string;
  name: string;
  is_active: boolean;
}

export interface CampaignTeamWorkspaceMemberResponse {
  id: string;
  campaign_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  member_type: CampaignTeamMemberUpsertInput['memberType'];
  app_user_id: string | null;
  app_access_status: CampaignTeamMemberUpsertInput['appAccessStatus'];
  is_active: boolean;
  app_user: CampaignTeamWorkspaceAppUserResponse | null;
  access_roles: CampaignMemberAccessRoleResponse[];
  teams: CampaignTeamWorkspaceTeamSummaryResponse[];
  team_memberships: CampaignTeamWorkspaceMembershipResponse[];
  created_at: string | null;
  updated_at: string | null;
}

export interface CampaignTeamWorkspaceTeamResponse {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  member_count: number;
  memberships: CampaignTeamWorkspaceMembershipResponse[];
  created_at: string | null;
  updated_at: string | null;
}

export interface CampaignDirectoryUserResponse {
  id: string;
  email: string;
  display_name: string;
  app_role: string;
  is_active: boolean;
  assigned_role_keys: string[];
  inactive_role_keys: string[];
}

export interface CampaignTeamWorkspaceResponse {
  campaign_id: string;
  counts: {
    member_count: number;
    active_member_count: number;
    members_with_app_access_count: number;
    active_assignment_count: number;
    manager_count: number;
    team_count: number;
  };
  members: CampaignTeamWorkspaceMemberResponse[];
  teams: CampaignTeamWorkspaceTeamResponse[];
  access_roles: CampaignMemberAccessRoleResponse[];
  directory_users: CampaignDirectoryUserResponse[];
  filters: {
    role_keys: string[];
    teams: Array<{
      id: string;
      name: string;
      is_active: boolean;
      member_count: number;
    }>;
    member_types: CampaignTeamMemberUpsertInput['memberType'][];
    app_access_statuses: NonNullable<CampaignTeamMemberUpsertInput['appAccessStatus']>[];
  };
}

export function mapCampaignTeamWorkspaceData(
  response: CampaignTeamWorkspaceResponse
): CampaignTeamWorkspaceData {
  return {
    campaignId: response.campaign_id,
    counts: {
      memberCount: response.counts.member_count,
      activeMemberCount: response.counts.active_member_count,
      membersWithAppAccessCount: response.counts.members_with_app_access_count,
      activeAssignmentCount: response.counts.active_assignment_count,
      managerCount: response.counts.manager_count,
      teamCount: response.counts.team_count,
    },
    members: response.members.map(mapCampaignTeamWorkspaceMember),
    teams: response.teams.map(mapCampaignTeamWorkspaceTeam),
    accessRoles: response.access_roles.map(mapCampaignMemberAccessRole),
    directoryUsers: response.directory_users.map(mapCampaignDirectoryUser),
    filters: {
      roleKeys: response.filters.role_keys,
      teams: response.filters.teams.map((team) => ({
        id: team.id,
        name: team.name,
        isActive: team.is_active,
        memberCount: team.member_count,
      })),
      memberTypes: response.filters.member_types,
      appAccessStatuses: response.filters.app_access_statuses,
    },
  };
}

export function mapCampaignTeamWorkspaceMember(
  member: CampaignTeamWorkspaceMemberResponse
): CampaignTeamWorkspaceMember {
  return {
    id: member.id,
    campaignId: member.campaign_id,
    displayName: member.display_name,
    email: member.email,
    phone: member.phone,
    notes: member.notes,
    memberType: member.member_type,
    appUserId: member.app_user_id,
    appAccessStatus: member.app_access_status ?? 'none',
    isActive: member.is_active,
    appUser: member.app_user ? mapCampaignTeamWorkspaceAppUser(member.app_user) : null,
    accessRoles: member.access_roles.map(mapCampaignMemberAccessRole),
    teams: member.teams.map((team) => ({
      id: team.id,
      name: team.name,
      isActive: team.is_active,
    })),
    teamMemberships: member.team_memberships.map(mapCampaignTeamWorkspaceMembership),
    createdAt: member.created_at,
    updatedAt: member.updated_at,
  };
}

export function mapCampaignTeamWorkspaceTeam(
  team: CampaignTeamWorkspaceTeamResponse
): CampaignTeamWorkspaceTeam {
  return {
    id: team.id,
    campaignId: team.campaign_id,
    name: team.name,
    description: team.description,
    isActive: team.is_active,
    memberCount: team.member_count,
    memberships: team.memberships.map(mapCampaignTeamWorkspaceMembership),
    createdAt: team.created_at,
    updatedAt: team.updated_at,
  };
}

export function mapCampaignDirectoryUser(
  user: CampaignDirectoryUserResponse
): CampaignDirectoryUserOption {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    appRole: user.app_role,
    isActive: user.is_active,
    assignedRoleKeys: user.assigned_role_keys,
    inactiveRoleKeys: user.inactive_role_keys,
  };
}

export function mapCampaignMemberAccessRole(
  role: CampaignMemberAccessRoleResponse
): CampaignMemberAccessRoleAssignment {
  return {
    id: role.id,
    campaignMemberId: role.campaign_member_id,
    roleKey: role.role_key,
    isActive: role.is_active,
    createdAt: role.created_at,
    updatedAt: role.updated_at,
  };
}

export function mapCampaignTeamWorkspaceMembership(
  membership: CampaignTeamWorkspaceMembershipResponse
): CampaignTeamWorkspaceTeamMembership {
  return {
    id: membership.id,
    teamId: membership.team_id,
    campaignMemberId: membership.campaign_member_id,
    createdAt: membership.created_at,
    updatedAt: membership.updated_at,
  };
}

export function mapCampaignTeamWorkspaceAppUser(
  user: CampaignTeamWorkspaceAppUserResponse
): CampaignTeamWorkspaceAppUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    appRole: user.app_role,
    isActive: user.is_active,
  };
}
