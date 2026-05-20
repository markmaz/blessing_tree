import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';

export function isAppAdminRole(role: string | null | undefined): boolean {
  const normalized = String(role ?? '').trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'APP_ADMIN';
}

export function canManageCampaign(access: CampaignAccess | null | undefined): boolean {
  return !!access?.capabilities.includes('campaign.admin');
}
