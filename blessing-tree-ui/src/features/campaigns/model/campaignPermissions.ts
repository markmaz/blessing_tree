import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';

export const campaignCapabilities = {
  view: 'campaign.view',
  admin: 'campaign.admin',
  peopleView: 'campaign.recipients.view',
  peopleEdit: 'campaign.recipients.edit',
  sponsorsView: 'campaign.sponsors.view',
  sponsorsManage: 'campaign.sponsors.manage',
  giftSearch: 'campaign.gifts.search',
  giftCommit: 'campaign.gifts.commit',
  giftCheckIn: 'campaign.gifts.check_in',
  giftWrap: 'campaign.gifts.wrap',
  giftDistribute: 'campaign.gifts.distribute',
  giftPoolManage: 'campaign.gifts.pool.manage',
  reportsView: 'campaign.reports.view',
} as const;

export const giftOperationsCapabilities = [
  campaignCapabilities.giftCheckIn,
  campaignCapabilities.giftWrap,
  campaignCapabilities.giftDistribute,
] as const;

export function isAppAdminRole(role: string | null | undefined): boolean {
  const normalized = String(role ?? '').trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'APP_ADMIN';
}

export function hasCampaignCapability(
  access: CampaignAccess | null | undefined,
  capability: string
): boolean {
  return access?.capabilities.includes(capability) === true;
}

export function hasAnyCampaignCapability(
  access: CampaignAccess | null | undefined,
  capabilities: readonly string[]
): boolean {
  return capabilities.some((capability) => hasCampaignCapability(access, capability));
}

export function canManageCampaign(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.admin);
}

export function canViewPeople(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.peopleView);
}

export function canManagePeople(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.peopleEdit);
}

export function canViewSponsors(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.sponsorsView);
}

export function canManageSponsors(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.sponsorsManage);
}

export function canUseGiftSearch(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.giftSearch);
}

export function canUseGiftOperations(access: CampaignAccess | null | undefined): boolean {
  return hasAnyCampaignCapability(access, giftOperationsCapabilities);
}

export function canUseGiftPool(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.giftPoolManage);
}

export function canViewReports(access: CampaignAccess | null | undefined): boolean {
  return hasCampaignCapability(access, campaignCapabilities.reportsView);
}
