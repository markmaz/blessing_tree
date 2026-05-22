/**
 * Central route constants for the application.
 * This prevents hardcoded strings and makes refactoring easier.
 */

export const routes = {
  LOGIN: '/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_CALLBACK: '/auth/callback',
  HOME: '/',
  DASHBOARD: '/',
  CAMPAIGNS: '/campaigns',
  CAMPAIGN_DETAIL: '/campaigns/:campaignId',
  CAMPAIGN_STUDIO: '/campaigns/:campaignId/studio',
  CAMPAIGN_PEOPLE: '/campaigns/:campaignId/people',
  CAMPAIGN_PEOPLE_INTAKE: '/campaigns/:campaignId/people/intake',
  CAMPAIGN_PEOPLE_DIRECTORY: '/campaigns/:campaignId/people/directory',
  DONATIONS: '/donations',
  REPORTS: '/reports',
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_LLM: '/admin/llm',
  ADMIN_HEALTH: '/admin/health',
  ADMIN_CAPABILITIES: '/admin/capabilities',
} as const;

export function buildCampaignDetailPath(campaignId: string): string {
  return `/campaigns/${campaignId}`;
}

export function buildCampaignStudioPath(campaignId: string): string {
  return `/campaigns/${campaignId}/studio`;
}

export function buildCampaignPeoplePath(campaignId: string): string {
  return `/campaigns/${campaignId}/people`;
}

export function buildCampaignPeopleIntakePath(campaignId: string): string {
  return `/campaigns/${campaignId}/people/intake`;
}

export function buildCampaignPeopleDirectoryPath(campaignId: string): string {
  return `/campaigns/${campaignId}/people/directory`;
}
