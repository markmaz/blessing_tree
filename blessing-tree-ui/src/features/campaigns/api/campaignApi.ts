import { apiFetchJson } from '@/shared/api/client';
import type {
  Campaign,
  CampaignAccess,
  CampaignListItem,
  CampaignSeasonReflection,
  CampaignSummary,
  CampaignSummaryCounts,
  CampaignUpsertInput,
} from '@/features/campaigns/model/campaignTypes';

interface CampaignAccessResponse {
  campaign_id: string;
  global_app_role: string;
  role_keys: string[];
  capabilities: string[];
}

interface CampaignResponse {
  id: string;
  name: string;
  year: number;
  description: string | null;
  season_theme: string | null;
  status: Campaign['status'];
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CampaignSeasonReflectionResponse {
  campaign_id: string;
  season_theme: string | null;
  source: 'llm' | 'fallback';
  fallback_reason: string | null;
  pair_id: string;
  verse: {
    id: string;
    reference: string;
    translation: string;
    text: string;
    tags: string[];
  };
  prayer: {
    id: string;
    title: string;
    citation: string;
    text: string;
    tags: string[];
  };
}

interface CampaignListItemResponse extends CampaignResponse {
  user_access: CampaignAccessResponse;
}

interface CampaignSummaryResponse {
  campaign_id: string;
  counts: Record<string, number>;
}

export async function listCampaigns(): Promise<CampaignListItem[]> {
  const response = await apiFetchJson<CampaignListItemResponse[]>('/api/v1/campaigns');
  return response.map((campaign) => ({
    ...mapCampaign(campaign),
    userAccess: mapCampaignAccess(campaign.user_access),
  }));
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  const response = await apiFetchJson<CampaignResponse>(`/api/v1/campaigns/${campaignId}`);
  return mapCampaign(response);
}

export async function getCampaignAccess(campaignId: string): Promise<CampaignAccess> {
  const response = await apiFetchJson<CampaignAccessResponse>(
    `/api/v1/campaigns/${campaignId}/access`
  );
  return mapCampaignAccess(response);
}

export async function getCampaignSummary(campaignId: string): Promise<CampaignSummary> {
  const response = await apiFetchJson<CampaignSummaryResponse>(
    `/api/v1/campaigns/${campaignId}/summary`
  );

  return {
    campaignId: response.campaign_id,
    counts: {
      recipientGroups: response.counts.recipient_groups ?? 0,
      recipients: response.counts.recipients ?? 0,
      wishlists: response.counts.wishlists ?? 0,
      wishlistItems: response.counts.wishlist_items ?? 0,
      donations: response.counts.donations ?? 0,
      sponsorships: response.counts.sponsorships ?? 0,
      sponsorshipItems: response.counts.sponsorship_items ?? 0,
      fulfillments: response.counts.fulfillments ?? 0,
      pickups: response.counts.pickups ?? 0,
    },
  };
}

export async function getCampaignSeasonReflection(
  campaignId: string,
  excludePairIds: string[] = []
): Promise<CampaignSeasonReflection> {
  const params = new URLSearchParams();
  if (excludePairIds.length > 0) {
    params.set('exclude_pair_ids', excludePairIds.join(','));
  }
  const response = await apiFetchJson<CampaignSeasonReflectionResponse>(
    `/api/v1/campaigns/${campaignId}/season-reflection${params.size ? `?${params.toString()}` : ''}`
  );

  return {
    campaignId: response.campaign_id,
    seasonTheme: response.season_theme,
    source: response.source,
    fallbackReason: response.fallback_reason,
    pairId: response.pair_id,
    verse: response.verse,
    prayer: response.prayer,
  };
}

export async function createCampaign(input: CampaignUpsertInput): Promise<Campaign> {
  const response = await apiFetchJson<CampaignResponse>('/api/v1/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeCampaignUpsertInput(input)),
  });

  return mapCampaign(response);
}

export async function updateCampaign(
  campaignId: string,
  input: CampaignUpsertInput
): Promise<Campaign> {
  const response = await apiFetchJson<CampaignResponse>(`/api/v1/campaigns/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeCampaignUpsertInput(input)),
  });

  return mapCampaign(response);
}

function mapCampaign(campaign: CampaignResponse): Campaign {
  return {
    id: campaign.id,
    name: campaign.name,
    year: campaign.year,
    description: campaign.description,
    seasonTheme: campaign.season_theme,
    status: campaign.status,
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  };
}

function mapCampaignAccess(access: CampaignAccessResponse): CampaignAccess {
  return {
    campaignId: access.campaign_id,
    globalAppRole: access.global_app_role,
    roleKeys: access.role_keys,
    capabilities: access.capabilities,
  };
}

function serializeCampaignUpsertInput(input: CampaignUpsertInput) {
  return {
    name: input.name,
    year: input.year,
    description: input.description,
    season_theme: input.seasonTheme,
    status: input.status,
    start_date: input.startDate,
    end_date: input.endDate,
    source_campaign_id: input.sourceCampaignId ?? null,
  };
}

export const campaignSummaryLabels: Array<{
  key: keyof CampaignSummaryCounts;
  label: string;
  icon: string;
}> = [
  { key: 'recipientGroups', label: 'Recipient Groups', icon: 'bi-diagram-3' },
  { key: 'recipients', label: 'Recipients', icon: 'bi-people' },
  { key: 'wishlists', label: 'Wishlists', icon: 'bi-journal-check' },
  { key: 'wishlistItems', label: 'Wishlist Items', icon: 'bi-gift' },
  { key: 'donations', label: 'Donations', icon: 'bi-cash-stack' },
  { key: 'sponsorships', label: 'Sponsorships', icon: 'bi-heart' },
  { key: 'sponsorshipItems', label: 'Sponsored Items', icon: 'bi-bag-heart' },
  { key: 'fulfillments', label: 'Fulfillments', icon: 'bi-check2-circle' },
  { key: 'pickups', label: 'Pickups', icon: 'bi-box-seam' },
];
