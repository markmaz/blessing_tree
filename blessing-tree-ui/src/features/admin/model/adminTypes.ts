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

export interface AdminFeaturesPayload {
  features: AdminFeatureFlag[];
}

export interface InviteValidationPayload {
  invitationId: string;
  userId: string;
  email: string;
  displayName: string;
  expiresAt: string;
}
