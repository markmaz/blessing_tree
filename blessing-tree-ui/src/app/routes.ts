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
  FAMILIES: '/families',
  DONATIONS: '/donations',
  REPORTS: '/reports',
  ADMIN: '/admin',
} as const;

export function buildCampaignDetailPath(campaignId: string): string {
  return `/campaigns/${campaignId}`;
}
