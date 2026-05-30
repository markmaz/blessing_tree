export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminInvitation {
  id: string;
  userId: string;
  email: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  inviteUrl?: string;
}

export interface AdminRoleCatalogItem {
  roleKey: string;
  label: string;
  description: string;
  capabilities?: string[];
}

export interface AdminCampaignAccessCampaign {
  id: string;
  name: string;
  year: number;
  status: string;
}

export interface AdminCampaignAccessRow {
  campaign: AdminCampaignAccessCampaign;
  roleKeys: string[];
  capabilities: string[];
}

export interface AdminUserCampaignAccessPayload {
  userId: string;
  campaigns: AdminCampaignAccessRow[];
  roleCatalog: AdminRoleCatalogItem[];
}

export interface AdminLlmProviderCatalogItem {
  provider: string;
  label: string;
  description: string;
}

export interface AdminLlmConfiguration {
  configured: boolean;
  id?: string;
  provider: string;
  label: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  isEnabled: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
}

export interface AdminFeatureFlag {
  featureKey: string;
  label: string;
  description: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminHealthCheck {
  status: string;
  message?: string;
  latencyMs?: number;
  provider?: string;
  model?: string;
  workers?: string[];
  workerHeartbeat?: boolean;
  configured?: boolean;
}

export interface AdminHealthPayload {
  overall: string;
  checkedAt: string;
  checks: {
    database: AdminHealthCheck;
    celery: AdminHealthCheck;
    llm: AdminHealthCheck;
  };
}

export interface AdminUsersPayload {
  users: AdminUser[];
  invitations: AdminInvitation[];
  roleCatalog: AdminRoleCatalogItem[];
}

export interface AdminLlmPayload {
  configuration: AdminLlmConfiguration;
  providerCatalog: AdminLlmProviderCatalogItem[];
}

export interface AdminLlmModelsPayload {
  configured: boolean;
  provider?: string;
  model?: string;
  models: string[];
  message?: string;
}

export interface AdminFeaturesPayload {
  features: AdminFeatureFlag[];
}

export interface AdminOrganizationType {
  id: string;
  code: string;
  label: string;
  recipientCategory: 'CHILD' | 'ADULT' | 'FAMILY';
  isActive: boolean;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminOrganizationTypesPayload {
  organizationTypes: AdminOrganizationType[];
}

export interface AdminAskReviewLog {
  id: string;
  campaignId: string;
  campaignName: string | null;
  userId: string | null;
  userName: string | null;
  prompt: string;
  resultKind: string;
  resultKey: string | null;
  confidence: number | null;
  source: string | null;
  responseSummary: Record<string, unknown>;
  feedbackRating: string | null;
  feedbackComment: string | null;
  feedbackAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  createdAt: string | null;
}

export interface AdminAskReviewPayload {
  logs: AdminAskReviewLog[];
  reviewOnly: boolean;
  limit: number;
}

export interface AdminAuditActor {
  userId: string | null;
  displayName: string | null;
  email: string | null;
}

export interface AdminAuditCampaign {
  id: string;
  name: string;
}

export interface AdminAuditChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface AdminAuditEventListItem {
  id: string;
  occurredAt: string;
  actor: AdminAuditActor | null;
  campaign: AdminAuditCampaign | null;
  area: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  changeCount: number;
}

export interface AdminAuditEventDetail extends AdminAuditEventListItem {
  changeSet: AdminAuditChange[];
  metadata: Record<string, unknown>;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminAuditEventsPayload {
  items: AdminAuditEventListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  filters: {
    areas: string[];
    actions: string[];
  };
}

export interface AdminAuditEventDetailPayload {
  event: AdminAuditEventDetail;
}

export interface AdminAuditEventFilters {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  campaignId?: string;
  area?: string;
  action?: string;
  entityType?: string;
  search?: string;
}

export interface InviteValidationPayload {
  invitationId: string;
  userId: string;
  email: string;
  displayName: string;
  expiresAt: string;
}
