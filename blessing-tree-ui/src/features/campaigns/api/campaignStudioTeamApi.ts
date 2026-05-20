import { apiFetchJson } from '@/shared/api/client';
import type {
  CampaignAssignment,
  CampaignDirectoryUser,
  CreateCampaignAssignmentInput,
} from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignTeamMemberResponse {
  id: string;
  email: string;
  display_name: string;
  app_role: string;
  is_active: boolean;
}

interface CampaignAssignmentResponse {
  id: string;
  campaign_id: string;
  user_id: string;
  role_key: string;
  is_active: boolean;
  user: CampaignTeamMemberResponse;
  created_at: string | null;
  updated_at: string | null;
}

interface CampaignDirectoryUserResponse {
  id: string;
  email: string;
  display_name: string;
  app_role: string;
  is_active: boolean;
  assigned_role_keys: string[];
  inactive_role_keys: string[];
}

export async function listCampaignDirectoryUsers(
  campaignId: string,
  search: string,
  limit = 8
): Promise<CampaignDirectoryUser[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set('search', search.trim());
  }
  params.set('limit', String(limit));
  const query = params.toString();

  const response = await apiFetchJson<CampaignDirectoryUserResponse[]>(
    `/api/v1/campaigns/${campaignId}/directory-users${query ? `?${query}` : ''}`
  );

  return response.map(mapDirectoryUser);
}

export async function createCampaignAssignment(
  campaignId: string,
  input: CreateCampaignAssignmentInput
): Promise<CampaignAssignment> {
  const response = await apiFetchJson<CampaignAssignmentResponse>(
    `/api/v1/campaigns/${campaignId}/assignments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: input.userId,
        role_key: input.roleKey,
        is_active: input.isActive ?? true,
      }),
    }
  );

  return mapCampaignAssignment(response);
}

function mapCampaignAssignment(
  assignment: CampaignAssignmentResponse
): CampaignAssignment {
  return {
    id: assignment.id,
    campaignId: assignment.campaign_id,
    userId: assignment.user_id,
    roleKey: assignment.role_key,
    isActive: assignment.is_active,
    user: {
      id: assignment.user.id,
      email: assignment.user.email,
      displayName: assignment.user.display_name,
      appRole: assignment.user.app_role,
      isActive: assignment.user.is_active,
    },
    createdAt: assignment.created_at,
    updatedAt: assignment.updated_at,
  };
}

function mapDirectoryUser(user: CampaignDirectoryUserResponse): CampaignDirectoryUser {
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
