/**
 * Central route constants for the application.
 * This prevents hardcoded strings and makes refactoring easier.
 */

export const routes = {
  LOGIN: '/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  PUBLIC_CAMPAIGN_SPONSOR: '/public/campaigns/:publicSlug/sponsor',
  PUBLIC_CAMPAIGN_SPONSOR_VERIFY: '/public/campaigns/:publicSlug/sponsor/verify',
  PUBLIC_GIFT_SCAN: '/public/gifts/scan/:labelCode',
  HOME: '/',
  DASHBOARD: '/',
  CAMPAIGNS: '/campaigns',
  CAMPAIGN_DETAIL: '/campaigns/:campaignId',
  CAMPAIGN_ASK: '/campaigns/:campaignId/ask',
  CAMPAIGN_STUDIO: '/campaigns/:campaignId/studio',
  CAMPAIGN_SPONSOR_FLYER: '/campaigns/:campaignId/studio/sponsor-flyer',
  CAMPAIGN_PEOPLE: '/campaigns/:campaignId/people',
  CAMPAIGN_PEOPLE_INTAKE: '/campaigns/:campaignId/people/intake',
  CAMPAIGN_PEOPLE_DIRECTORY: '/campaigns/:campaignId/people/directory',
  CAMPAIGN_PEOPLE_REPORTS: '/campaigns/:campaignId/people/reports',
  CAMPAIGN_SPONSORS: '/campaigns/:campaignId/sponsors',
  CAMPAIGN_SPONSORS_INTAKE: '/campaigns/:campaignId/sponsors/intake',
  CAMPAIGN_SPONSORS_DIRECTORY: '/campaigns/:campaignId/sponsors/directory',
  CAMPAIGN_SPONSORS_REPORTS: '/campaigns/:campaignId/sponsors/reports',
  CAMPAIGN_GIFTS_SEARCH: '/campaigns/:campaignId/gifts/search',
  CAMPAIGN_GIFTS_OPERATIONS: '/campaigns/:campaignId/gifts/operations',
  CAMPAIGN_GIFTS_POOL: '/campaigns/:campaignId/gifts/pool',
  CAMPAIGN_GIFTS_REPORTS: '/campaigns/:campaignId/gifts/reports',
  CAMPAIGN_GIFTS_TAG_BUILDER: '/campaigns/:campaignId/gifts/tag-builder',
  SCAN_GIFT: '/scan/gifts/:labelCode',
  ACCOUNT_PROFILE: '/account/profile',
  ACCOUNT_SETTINGS: '/account/settings',
  REPORTS: '/reports',
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_ACTIVITY_LOG: '/admin/activity-log',
  ADMIN_ASK_REVIEW: '/admin/ask-review',
  ADMIN_CAMPAIGN_OPERATIONS: '/admin/campaign-operations',
  ADMIN_ORGANIZATION_TYPES: '/admin/organization-types',
  ADMIN_LLM: '/admin/llm',
  ADMIN_HEALTH: '/admin/health',
  ADMIN_CAPABILITIES: '/admin/capabilities',
} as const;

export function buildCampaignDetailPath(campaignId: string): string {
  return `/campaigns/${campaignId}`;
}

export function buildCampaignAskPath(campaignId: string): string {
  return `/campaigns/${campaignId}/ask`;
}

export function buildCampaignStudioPath(campaignId: string): string {
  return `/campaigns/${campaignId}/studio`;
}

export function buildCampaignSponsorFlyerPath(campaignId: string): string {
  return `/campaigns/${campaignId}/studio/sponsor-flyer`;
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

export function buildCampaignPeopleReportsPath(campaignId: string): string {
  return `/campaigns/${campaignId}/people/reports`;
}

export function buildCampaignSponsorsPath(campaignId: string): string {
  return `/campaigns/${campaignId}/sponsors`;
}

export function buildCampaignSponsorsIntakePath(campaignId: string): string {
  return `/campaigns/${campaignId}/sponsors/intake`;
}

export function buildCampaignSponsorsDirectoryPath(campaignId: string): string {
  return `/campaigns/${campaignId}/sponsors/directory`;
}

export function buildCampaignSponsorsReportsPath(campaignId: string): string {
  return `/campaigns/${campaignId}/sponsors/reports`;
}

export function buildCampaignGiftsSearchPath(campaignId: string): string {
  return `/campaigns/${campaignId}/gifts/search`;
}

export function buildCampaignGiftsOperationsPath(campaignId: string): string {
  return `/campaigns/${campaignId}/gifts/operations`;
}

export function buildCampaignGiftsPoolPath(campaignId: string): string {
  return `/campaigns/${campaignId}/gifts/pool`;
}

export function buildCampaignGiftsReportsPath(campaignId: string): string {
  return `/campaigns/${campaignId}/gifts/reports`;
}

export function buildCampaignGiftsTagBuilderPath(campaignId: string): string {
  return `/campaigns/${campaignId}/gifts/tag-builder`;
}

export function buildGiftScanPath(labelCode: string): string {
  return `/scan/gifts/${encodeURIComponent(labelCode)}`;
}

export function buildPublicGiftScanPath(labelCode: string): string {
  return `/public/gifts/scan/${encodeURIComponent(labelCode)}`;
}

export function buildPublicCampaignSponsorPath(publicSlug: string): string {
  return `/public/campaigns/${publicSlug}/sponsor`;
}

export function buildPublicCampaignSponsorVerifyPath(publicSlug: string): string {
  return `/public/campaigns/${publicSlug}/sponsor/verify`;
}
