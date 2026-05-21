export type CampaignMemberType = 'staff' | 'volunteer' | 'contact' | 'external';

export type CampaignMemberAppAccessStatus = 'none' | 'linked' | 'invited' | 'active';

export interface CampaignTeamWorkspaceAppUser {
  id: string;
  email: string;
  displayName: string;
  appRole: string;
  isActive: boolean;
}

export interface CampaignRoleCatalogEntry {
  roleKey: string;
  label: string;
  description: string;
  capabilities: string[];
}

export interface CampaignMemberAccessRoleAssignment {
  id: string;
  campaignMemberId: string;
  roleKey: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignTeamRole {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignTeamWorkspaceTeamMembership {
  id: string;
  teamId: string;
  campaignMemberId: string;
  teamRoleId: string | null;
  teamRole: CampaignTeamRole | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignTeamWorkspaceTeamSummary {
  id: string;
  name: string;
  isActive: boolean;
  teamRoleId: string | null;
  teamRoleName: string | null;
}

export interface CampaignTeamWorkspaceMember {
  id: string;
  campaignId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  memberType: CampaignMemberType;
  appUserId: string | null;
  appAccessStatus: CampaignMemberAppAccessStatus;
  isActive: boolean;
  appUser: CampaignTeamWorkspaceAppUser | null;
  accessRoles: CampaignMemberAccessRoleAssignment[];
  teams: CampaignTeamWorkspaceTeamSummary[];
  teamMemberships: CampaignTeamWorkspaceTeamMembership[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignTeamWorkspaceTeam {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  memberCount: number;
  roles: CampaignTeamRole[];
  memberships: CampaignTeamWorkspaceTeamMembership[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignDirectoryUserOption {
  id: string;
  email: string;
  displayName: string;
  appRole: string;
  isActive: boolean;
  assignedRoleKeys: string[];
  inactiveRoleKeys: string[];
}

export interface CampaignTeamWorkspaceCounts {
  memberCount: number;
  activeMemberCount: number;
  membersWithAppAccessCount: number;
  activeAssignmentCount: number;
  managerCount: number;
  teamCount: number;
}

export interface CampaignTeamWorkspaceFilters {
  roleKeys: string[];
  teams: Array<{
    id: string;
    name: string;
    isActive: boolean;
    memberCount: number;
  }>;
  memberTypes: CampaignMemberType[];
  appAccessStatuses: CampaignMemberAppAccessStatus[];
}

export interface CampaignTeamWorkspaceData {
  campaignId: string;
  counts: CampaignTeamWorkspaceCounts;
  members: CampaignTeamWorkspaceMember[];
  teams: CampaignTeamWorkspaceTeam[];
  accessRoles: CampaignMemberAccessRoleAssignment[];
  directoryUsers: CampaignDirectoryUserOption[];
  roleCatalog: CampaignRoleCatalogEntry[];
  filters: CampaignTeamWorkspaceFilters;
}

export interface CampaignTeamMemberUpsertInput {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  memberType: CampaignMemberType;
  appAccessStatus?: CampaignMemberAppAccessStatus;
  isActive?: boolean;
}

export interface CampaignMemberAccessRoleUpsertInput {
  roleKey: string;
  isActive?: boolean;
}

export interface CampaignTeamUpsertInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CampaignTeamRoleUpsertInput {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CampaignMemberAppLinkInput {
  userId: string;
  appAccessStatus?: 'linked' | 'active';
}

export interface CampaignMemberAppInviteInput {
  userId?: string | null;
  appAccessStatus?: 'invited' | 'linked' | 'active';
}
