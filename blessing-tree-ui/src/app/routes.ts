/**
 * Central route constants for the application.
 * This prevents hardcoded strings and makes refactoring easier.
 */

export const routes = {
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth/callback',
  HOME: '/',
  DASHBOARD: '/',
  CAMPAIGNS: '/campaigns',
  CAMPAIGN_DETAIL: '/campaigns/:campaignId',
  CAMPAIGN_STUDIO: '/campaigns/:campaignId/studio',
  FAMILIES: '/families',
  DONATIONS: '/donations',
  REPORTS: '/reports',
  ADMIN: '/admin',
} as const;

export function buildCampaignDetailPath(campaignId: string): string {
  return `/campaigns/${campaignId}`;
}

export function buildCampaignStudioPath(campaignId: string): string {
  return `/campaigns/${campaignId}/studio`;
}
