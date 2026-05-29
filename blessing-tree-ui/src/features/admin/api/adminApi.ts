import { apiFetchJson } from '@/shared/api/client';
import type {
  AdminFeatureFlag,
  AdminAskReviewLog,
  AdminAskReviewPayload,
  AdminFeaturesPayload,
  AdminHealthPayload,
  AdminUserCampaignAccessPayload,
  AdminInvitation,
  AdminLlmModelsPayload,
  AdminLlmPayload,
  AdminOrganizationType,
  AdminOrganizationTypesPayload,
  AdminUsersPayload,
} from '@/features/admin/model/adminTypes';

function normalizeUserPayload(payload: AdminUsersPayload): AdminUsersPayload {
  return {
    users: (payload.users ?? []).map((user) => ({
      ...user,
      displayName: user.displayName ?? (user as unknown as { display_name?: string }).display_name ?? '',
      isActive: Boolean(user.isActive ?? (user as unknown as { is_active?: boolean }).is_active),
      lastLoginAt:
        user.lastLoginAt ?? (user as unknown as { last_login_at?: string | null }).last_login_at ?? null,
      createdAt: user.createdAt ?? (user as unknown as { created_at?: string }).created_at ?? '',
      updatedAt: user.updatedAt ?? (user as unknown as { updated_at?: string }).updated_at ?? '',
    })),
    invitations: (payload.invitations ?? []).map((invitation) => ({
      ...invitation,
      userId: invitation.userId ?? (invitation as unknown as { user_id?: string }).user_id ?? '',
      expiresAt: invitation.expiresAt ?? (invitation as unknown as { expires_at?: string }).expires_at ?? '',
      acceptedAt:
        invitation.acceptedAt ??
        (invitation as unknown as { accepted_at?: string | null }).accepted_at ??
        null,
      revokedAt:
        invitation.revokedAt ??
        (invitation as unknown as { revoked_at?: string | null }).revoked_at ??
        null,
      createdAt: invitation.createdAt ?? (invitation as unknown as { created_at?: string }).created_at ?? '',
      updatedAt: invitation.updatedAt ?? (invitation as unknown as { updated_at?: string }).updated_at ?? '',
      inviteUrl: invitation.inviteUrl ?? (invitation as unknown as { invite_url?: string }).invite_url,
    })),
    roleCatalog: (payload.roleCatalog ??
      (payload as unknown as { role_catalog?: AdminUsersPayload['roleCatalog'] }).role_catalog ??
      []
    ).map((item) => ({
      roleKey: item.roleKey ?? (item as unknown as { role_key?: string }).role_key ?? '',
      label: item.label,
      description: item.description,
      capabilities: item.capabilities ?? [],
    })),
  };
}

function normalizeCampaignAccessPayload(payload: AdminUserCampaignAccessPayload): AdminUserCampaignAccessPayload {
  return {
    userId: payload.userId ?? (payload as unknown as { user_id?: string }).user_id ?? '',
    roleCatalog: (payload.roleCatalog ??
      (payload as unknown as { role_catalog?: AdminUserCampaignAccessPayload['roleCatalog'] }).role_catalog ??
      []
    ).map((item) => ({
      roleKey: item.roleKey ?? (item as unknown as { role_key?: string }).role_key ?? '',
      label: item.label,
      description: item.description,
      capabilities: item.capabilities ?? [],
    })),
    campaigns: (payload.campaigns ?? []).map((row) => ({
      campaign: row.campaign,
      roleKeys: row.roleKeys ?? (row as unknown as { role_keys?: string[] }).role_keys ?? [],
      capabilities: row.capabilities ?? [],
    })),
  };
}

function normalizeLlmPayload(payload: AdminLlmPayload): AdminLlmPayload {
  return {
    configuration: {
      ...payload.configuration,
      baseUrl:
        payload.configuration.baseUrl ??
        (payload.configuration as unknown as { base_url?: string }).base_url ??
        '',
      apiKeyConfigured:
        payload.configuration.apiKeyConfigured ??
        Boolean((payload.configuration as unknown as { api_key_configured?: boolean }).api_key_configured),
      isEnabled:
        payload.configuration.isEnabled ??
        Boolean((payload.configuration as unknown as { is_enabled?: boolean }).is_enabled),
      lastTestedAt:
        payload.configuration.lastTestedAt ??
        (payload.configuration as unknown as { last_tested_at?: string | null }).last_tested_at ??
        null,
      lastTestStatus:
        payload.configuration.lastTestStatus ??
        (payload.configuration as unknown as { last_test_status?: string | null }).last_test_status ??
        null,
      lastTestMessage:
        payload.configuration.lastTestMessage ??
        (payload.configuration as unknown as { last_test_message?: string | null }).last_test_message ??
        null,
    },
    providerCatalog: (payload.providerCatalog ??
      (payload as unknown as { provider_catalog?: AdminLlmPayload['providerCatalog'] }).provider_catalog ??
      []
    ).map((item) => ({
      provider: item.provider,
      label: item.label,
      description: item.description,
    })),
  };
}

function normalizeFeaturesPayload(payload: AdminFeaturesPayload): AdminFeaturesPayload {
  return {
    features: (payload.features ?? []).map((feature) => ({
      featureKey: feature.featureKey ?? (feature as unknown as { feature_key?: string }).feature_key ?? '',
      label: feature.label,
      description: feature.description,
      isEnabled: feature.isEnabled ?? Boolean((feature as unknown as { is_enabled?: boolean }).is_enabled),
      createdAt: feature.createdAt ?? (feature as unknown as { created_at?: string }).created_at ?? '',
      updatedAt: feature.updatedAt ?? (feature as unknown as { updated_at?: string }).updated_at ?? '',
    })),
  };
}

function normalizeFeature(feature: AdminFeatureFlag): AdminFeatureFlag {
  return {
    featureKey: feature.featureKey ?? (feature as unknown as { feature_key?: string }).feature_key ?? '',
    label: feature.label,
    description: feature.description,
    isEnabled: feature.isEnabled ?? Boolean((feature as unknown as { is_enabled?: boolean }).is_enabled),
    createdAt: feature.createdAt ?? (feature as unknown as { created_at?: string }).created_at ?? '',
    updatedAt: feature.updatedAt ?? (feature as unknown as { updated_at?: string }).updated_at ?? '',
  };
}

function normalizeOrganizationType(type: AdminOrganizationType): AdminOrganizationType {
  return {
    id: type.id,
    code: type.code,
    label: type.label,
    recipientCategory:
      type.recipientCategory ??
      (type as unknown as { recipient_category?: AdminOrganizationType['recipientCategory'] }).recipient_category ??
      'ADULT',
    isActive: type.isActive ?? Boolean((type as unknown as { is_active?: boolean }).is_active),
    sortOrder: type.sortOrder ?? (type as unknown as { sort_order?: number }).sort_order ?? 100,
    createdAt: type.createdAt ?? (type as unknown as { created_at?: string | null }).created_at ?? null,
    updatedAt: type.updatedAt ?? (type as unknown as { updated_at?: string | null }).updated_at ?? null,
  };
}

function normalizeOrganizationTypesPayload(payload: AdminOrganizationTypesPayload): AdminOrganizationTypesPayload {
  return {
    organizationTypes: (
      payload.organizationTypes ??
      (payload as unknown as { organization_types?: AdminOrganizationType[] }).organization_types ??
      []
    ).map(normalizeOrganizationType),
  };
}

function normalizeAskReviewPayload(payload: AdminAskReviewPayload): AdminAskReviewPayload {
  return {
    reviewOnly: payload.reviewOnly ?? (payload as unknown as { review_only?: boolean }).review_only ?? true,
    limit: Number(payload.limit ?? 100),
    logs: (payload.logs ?? []).map((log) => ({
      id: log.id,
      campaignId: log.campaignId ?? (log as unknown as { campaign_id?: string }).campaign_id ?? '',
      campaignName:
        log.campaignName ??
        (log as unknown as { campaign_name?: string | null }).campaign_name ??
        null,
      userId: log.userId ?? (log as unknown as { user_id?: string | null }).user_id ?? null,
      userName: log.userName ?? (log as unknown as { user_name?: string | null }).user_name ?? null,
      prompt: log.prompt,
      resultKind: log.resultKind ?? (log as unknown as { result_kind?: string }).result_kind ?? '',
      resultKey: log.resultKey ?? (log as unknown as { result_key?: string | null }).result_key ?? null,
      confidence: log.confidence == null ? null : Number(log.confidence),
      source: log.source,
      responseSummary:
        log.responseSummary ??
        (log as unknown as { response_summary?: Record<string, unknown> }).response_summary ??
        {},
      feedbackRating:
        log.feedbackRating ??
        (log as unknown as { feedback_rating?: string | null }).feedback_rating ??
        null,
      feedbackComment:
        log.feedbackComment ??
        (log as unknown as { feedback_comment?: string | null }).feedback_comment ??
        null,
      feedbackAt:
        log.feedbackAt ??
        (log as unknown as { feedback_at?: string | null }).feedback_at ??
        null,
      reviewedAt:
        log.reviewedAt ??
        (log as unknown as { reviewed_at?: string | null }).reviewed_at ??
        null,
      reviewedByUserId:
        log.reviewedByUserId ??
        (log as unknown as { reviewed_by_user_id?: string | null }).reviewed_by_user_id ??
        null,
      reviewNote:
        log.reviewNote ??
        (log as unknown as { review_note?: string | null }).review_note ??
        null,
      createdAt: log.createdAt ?? (log as unknown as { created_at?: string | null }).created_at ?? null,
    })),
  };
}

export async function fetchAdminUsers(): Promise<AdminUsersPayload> {
  return normalizeUserPayload(await apiFetchJson<AdminUsersPayload>('/api/v1/admin/users'));
}

export async function createAdminInvite(input: {
  email: string;
  displayName: string;
  role: string;
}): Promise<{ invitation: AdminInvitation }> {
  const payload = await apiFetchJson<{ invitation: AdminInvitation }>('/api/v1/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      display_name: input.displayName,
      role: input.role,
    }),
  });
  return {
    invitation: normalizeUserPayload({
      users: [],
      invitations: [payload.invitation],
      roleCatalog: [],
    }).invitations[0],
  };
}

export async function resendAdminInvite(invitationId: string): Promise<AdminInvitation> {
  const payload = await apiFetchJson<{ invitation: AdminInvitation }>(
    `/api/v1/admin/invitations/${invitationId}/resend`,
    { method: 'POST' }
  );
  return normalizeUserPayload({
    users: [],
    invitations: [payload.invitation],
    roleCatalog: [],
  }).invitations[0];
}

export async function updateAdminUserStatus(
  userId: string,
  isActive: boolean
): Promise<AdminUsersPayload['users'][number]> {
  const payload = await apiFetchJson<{ user: AdminUsersPayload['users'][number] }>(
    `/api/v1/admin/users/${userId}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    }
  );

  return normalizeUserPayload({
    users: [payload.user],
    invitations: [],
    roleCatalog: [],
  }).users[0];
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await apiFetchJson<void>(`/api/v1/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateAdminUserRole(
  userId: string,
  role: string
): Promise<AdminUsersPayload['users'][number]> {
  const payload = await apiFetchJson<{ user: AdminUsersPayload['users'][number] }>(
    `/api/v1/admin/users/${userId}/role`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }
  );
  return normalizeUserPayload({
    users: [payload.user],
    invitations: [],
    roleCatalog: [],
  }).users[0];
}

export async function fetchAdminUserCampaignAccess(
  userId: string
): Promise<AdminUserCampaignAccessPayload> {
  const payload = await apiFetchJson<AdminUserCampaignAccessPayload>(
    `/api/v1/admin/users/${userId}/campaign-access`
  );
  return normalizeCampaignAccessPayload(payload);
}

export async function updateAdminUserCampaignAccess(
  userId: string,
  assignments: Array<{ campaignId: string; roleKeys: string[] }>
): Promise<AdminUserCampaignAccessPayload> {
  const payload = await apiFetchJson<AdminUserCampaignAccessPayload>(
    `/api/v1/admin/users/${userId}/campaign-access`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments: assignments.map((assignment) => ({
          campaign_id: assignment.campaignId,
          role_keys: assignment.roleKeys,
        })),
      }),
    }
  );
  return normalizeCampaignAccessPayload(payload);
}

export async function fetchAdminLlmConfig(): Promise<AdminLlmPayload> {
  return normalizeLlmPayload(await apiFetchJson<AdminLlmPayload>('/api/v1/admin/llm'));
}

export async function saveAdminLlmConfig(input: {
  provider: string;
  label: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  isEnabled: boolean;
}): Promise<AdminLlmPayload['configuration']> {
  const payload = await apiFetchJson<{ configuration: AdminLlmPayload['configuration'] }>(
    '/api/v1/admin/llm',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: input.provider,
        label: input.label,
        base_url: input.baseUrl,
        model: input.model,
        api_key: input.apiKey,
        is_enabled: input.isEnabled,
      }),
    }
  );
  return normalizeLlmPayload({
    configuration: payload.configuration,
    providerCatalog: [],
  }).configuration;
}

export async function testAdminLlmConfig(): Promise<AdminHealthPayload['checks']['llm']> {
  return apiFetchJson<AdminHealthPayload['checks']['llm']>('/api/v1/admin/llm/test', {
    method: 'POST',
  });
}

export async function fetchAdminLlmModels(): Promise<AdminLlmModelsPayload> {
  return apiFetchJson<AdminLlmModelsPayload>('/api/v1/admin/llm/models');
}

export async function fetchAdminHealth(): Promise<AdminHealthPayload> {
  const payload = await apiFetchJson<AdminHealthPayload>('/api/v1/admin/health');
  return {
    overall: payload.overall,
    checkedAt: payload.checkedAt ?? (payload as unknown as { checked_at?: string }).checked_at ?? '',
    checks: {
      database: payload.checks.database,
      celery: {
        ...payload.checks.celery,
        workerHeartbeat:
          payload.checks.celery.workerHeartbeat ??
          (payload.checks.celery as unknown as { worker_heartbeat?: boolean }).worker_heartbeat ??
          false,
      },
      llm: payload.checks.llm,
    },
  };
}

export async function fetchFeatureFlags(): Promise<AdminFeaturesPayload> {
  return normalizeFeaturesPayload(await apiFetchJson<AdminFeaturesPayload>('/api/v1/admin/features'));
}

export async function updateFeatureFlag(
  featureKey: string,
  isEnabled: boolean
): Promise<AdminFeatureFlag> {
  const payload = await apiFetchJson<{ feature: AdminFeatureFlag }>(
    `/api/v1/admin/features/${featureKey}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: isEnabled }),
    }
  );
  return normalizeFeature(payload.feature);
}

export async function fetchOrganizationTypes(): Promise<AdminOrganizationTypesPayload> {
  return normalizeOrganizationTypesPayload(
    await apiFetchJson<AdminOrganizationTypesPayload>('/api/v1/admin/organization-types')
  );
}

export async function createOrganizationType(input: {
  code?: string;
  label: string;
  recipientCategory: AdminOrganizationType['recipientCategory'];
  isActive: boolean;
  sortOrder: number;
}): Promise<AdminOrganizationType> {
  const payload = await apiFetchJson<{ organization_type: AdminOrganizationType }>(
    '/api/v1/admin/organization-types',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: input.code,
        label: input.label,
        recipient_category: input.recipientCategory,
        is_active: input.isActive,
        sort_order: input.sortOrder,
      }),
    }
  );
  return normalizeOrganizationType(payload.organization_type);
}

export async function updateOrganizationType(
  code: string,
  input: {
    label: string;
    recipientCategory: AdminOrganizationType['recipientCategory'];
    isActive: boolean;
    sortOrder: number;
  }
): Promise<AdminOrganizationType> {
  const payload = await apiFetchJson<{ organization_type: AdminOrganizationType }>(
    `/api/v1/admin/organization-types/${encodeURIComponent(code)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: input.label,
        recipient_category: input.recipientCategory,
        is_active: input.isActive,
        sort_order: input.sortOrder,
      }),
    }
  );
  return normalizeOrganizationType(payload.organization_type);
}

export async function deleteOrganizationType(code: string): Promise<void> {
  await apiFetchJson<void>(`/api/v1/admin/organization-types/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminAskReview(reviewOnly = true): Promise<AdminAskReviewPayload> {
  const params = new URLSearchParams({ review_only: reviewOnly ? 'true' : 'false' });
  return normalizeAskReviewPayload(await apiFetchJson<AdminAskReviewPayload>(`/api/v1/admin/ask/review?${params}`));
}

export async function markAdminAskPromptReviewed(promptLogId: string, reviewNote = ''): Promise<AdminAskReviewLog> {
  const payload = await apiFetchJson<{ log: AdminAskReviewLog }>(`/api/v1/admin/ask/review/${promptLogId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_note: reviewNote }),
  });
  return normalizeAskReviewPayload({ logs: [payload.log], reviewOnly: false, limit: 1 }).logs[0];
}
