import { apiFetchJson } from '@/shared/api/client';
import {
  mapCampaignMemberAccessRole,
  mapCampaignTeamWorkspaceData,
  mapCampaignTeamWorkspaceMember,
  mapCampaignTeamWorkspaceMembership,
  mapCampaignTeamWorkspaceTeam,
  type CampaignMemberAccessRoleResponse,
  type CampaignTeamWorkspaceMemberResponse,
  type CampaignTeamWorkspaceMembershipResponse,
  type CampaignTeamWorkspaceResponse,
  type CampaignTeamWorkspaceTeamResponse,
} from '@/features/campaigns/api/campaignTeamWorkspaceMappers';
import type {
  CampaignMemberAccessRoleAssignment,
  CampaignMemberAppInviteInput,
  CampaignMemberAppLinkInput,
  CampaignTeamMemberUpsertInput,
  CampaignMemberAccessRoleUpsertInput,
  CampaignTeamUpsertInput,
  CampaignTeamWorkspaceData,
  CampaignTeamWorkspaceMember,
  CampaignTeamWorkspaceTeam,
  CampaignTeamWorkspaceTeamMembership,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

export async function getCampaignTeamWorkspace(
  campaignId: string
): Promise<CampaignTeamWorkspaceData> {
  const response = await apiFetchJson<CampaignTeamWorkspaceResponse>(
    `/api/v1/campaigns/${campaignId}/team-workspace`
  );

  return mapCampaignTeamWorkspaceData(response);
}

export async function createCampaignMember(
  campaignId: string,
  input: CampaignTeamMemberUpsertInput
): Promise<CampaignTeamWorkspaceMember> {
  const response = await apiFetchJson<CampaignTeamWorkspaceMemberResponse>(
    `/api/v1/campaigns/${campaignId}/members`,
    withJson('POST', {
      display_name: input.displayName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      member_type: input.memberType,
      app_access_status: input.appAccessStatus ?? 'none',
      is_active: input.isActive ?? true,
    })
  );

  return mapCampaignTeamWorkspaceMember(response);
}

export async function updateCampaignMember(
  campaignId: string,
  memberId: string,
  input: Partial<CampaignTeamMemberUpsertInput>
): Promise<CampaignTeamWorkspaceMember> {
  const payload: Record<string, unknown> = {};
  if ('displayName' in input) payload.display_name = input.displayName;
  if ('email' in input) payload.email = input.email ?? null;
  if ('phone' in input) payload.phone = input.phone ?? null;
  if ('notes' in input) payload.notes = input.notes ?? null;
  if ('memberType' in input) payload.member_type = input.memberType;
  if ('appAccessStatus' in input) payload.app_access_status = input.appAccessStatus;
  if ('isActive' in input) payload.is_active = input.isActive;

  const response = await apiFetchJson<CampaignTeamWorkspaceMemberResponse>(
    `/api/v1/campaigns/${campaignId}/members/${memberId}`,
    withJson('PATCH', payload)
  );

  return mapCampaignTeamWorkspaceMember(response);
}

export async function createCampaignMemberAccessRole(
  campaignId: string,
  memberId: string,
  input: CampaignMemberAccessRoleUpsertInput
): Promise<CampaignMemberAccessRoleAssignment> {
  const response = await apiFetchJson<CampaignMemberAccessRoleResponse>(
    `/api/v1/campaigns/${campaignId}/members/${memberId}/access-roles`,
    withJson('POST', {
      role_key: input.roleKey,
      is_active: input.isActive ?? true,
    })
  );

  return mapCampaignMemberAccessRole(response);
}

export async function updateCampaignMemberAccessRole(
  campaignId: string,
  memberId: string,
  assignmentId: string,
  input: CampaignMemberAccessRoleUpsertInput
): Promise<CampaignMemberAccessRoleAssignment> {
  const response = await apiFetchJson<CampaignMemberAccessRoleResponse>(
    `/api/v1/campaigns/${campaignId}/members/${memberId}/access-roles/${assignmentId}`,
    withJson('PATCH', {
      role_key: input.roleKey,
      is_active: input.isActive ?? true,
    })
  );

  return mapCampaignMemberAccessRole(response);
}

export async function createCampaignTeam(
  campaignId: string,
  input: CampaignTeamUpsertInput
): Promise<CampaignTeamWorkspaceTeam> {
  const response = await apiFetchJson<CampaignTeamWorkspaceTeamResponse>(
    `/api/v1/campaigns/${campaignId}/teams`,
    withJson('POST', {
      name: input.name,
      description: input.description ?? null,
      is_active: input.isActive ?? true,
    })
  );

  return mapCampaignTeamWorkspaceTeam(response);
}

export async function updateCampaignTeam(
  campaignId: string,
  teamId: string,
  input: Partial<CampaignTeamUpsertInput>
): Promise<CampaignTeamWorkspaceTeam> {
  const payload: Record<string, unknown> = {};
  if ('name' in input) payload.name = input.name;
  if ('description' in input) payload.description = input.description ?? null;
  if ('isActive' in input) payload.is_active = input.isActive;

  const response = await apiFetchJson<CampaignTeamWorkspaceTeamResponse>(
    `/api/v1/campaigns/${campaignId}/teams/${teamId}`,
    withJson('PATCH', payload)
  );

  return mapCampaignTeamWorkspaceTeam(response);
}

export async function addCampaignTeamMember(
  campaignId: string,
  teamId: string,
  memberId: string
): Promise<CampaignTeamWorkspaceTeamMembership> {
  const response = await apiFetchJson<CampaignTeamWorkspaceMembershipResponse>(
    `/api/v1/campaigns/${campaignId}/teams/${teamId}/members`,
    withJson('POST', { member_id: memberId })
  );

  return mapCampaignTeamWorkspaceMembership(response);
}

export async function removeCampaignTeamMember(
  campaignId: string,
  teamId: string,
  memberId: string
): Promise<void> {
  await apiFetchJson(
    `/api/v1/campaigns/${campaignId}/teams/${teamId}/members/${memberId}`,
    { method: 'DELETE' }
  );
}

export async function linkCampaignMemberAppUser(
  campaignId: string,
  memberId: string,
  input: CampaignMemberAppLinkInput
): Promise<CampaignTeamWorkspaceMember> {
  const response = await apiFetchJson<CampaignTeamWorkspaceMemberResponse>(
    `/api/v1/campaigns/${campaignId}/members/${memberId}/link-app-user`,
    withJson('POST', {
      user_id: input.userId,
      app_access_status: input.appAccessStatus ?? 'linked',
    })
  );

  return mapCampaignTeamWorkspaceMember(response);
}

export async function inviteCampaignMemberAppAccess(
  campaignId: string,
  memberId: string,
  input: CampaignMemberAppInviteInput
): Promise<CampaignTeamWorkspaceMember> {
  const response = await apiFetchJson<CampaignTeamWorkspaceMemberResponse>(
    `/api/v1/campaigns/${campaignId}/members/${memberId}/invite-app-access`,
    withJson('POST', {
      user_id: input.userId ?? null,
      app_access_status: input.appAccessStatus ?? 'invited',
    })
  );

  return mapCampaignTeamWorkspaceMember(response);
}

export async function removeCampaignMemberAppAccess(
  campaignId: string,
  memberId: string
): Promise<CampaignTeamWorkspaceMember> {
  const response = await apiFetchJson<CampaignTeamWorkspaceMemberResponse>(
    `/api/v1/campaigns/${campaignId}/members/${memberId}/app-access`,
    { method: 'DELETE' }
  );

  return mapCampaignTeamWorkspaceMember(response);
}

function withJson(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
