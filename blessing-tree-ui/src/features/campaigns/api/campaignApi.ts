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
  public_sponsor_slug: string | null;
  public_sponsor_signup_enabled: boolean;
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
  widgets?: {
    population?: {
      children?: number;
      adults?: number;
      gifts?: number;
      unsponsored_gifts?: number;
    };
    popular_gifts_by_gender?: Array<{
      gender?: string;
      gift?: string;
      quantity?: number;
      request_count?: number;
    }>;
    sponsor_recipient_counts?: Array<{
      sponsor_id?: string;
      sponsor_name?: string;
      email?: string | null;
      recipient_count?: number;
      gift_count?: number;
    }>;
    unsponsored_gifts?: {
      count?: number;
      items?: Array<{
        wishlist_item_id?: string;
        gift?: string;
        category?: string | null;
        recipient_name?: string | null;
        group_name?: string | null;
      }>;
    };
    continue_where_left_off?: Array<{
      prompt_log_id?: string;
      prompt?: string;
      result_kind?: string;
      result_key?: string | null;
      title?: string | null;
      created_at?: string | null;
    }>;
  };
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
    widgets: mapCampaignDashboardWidgets(response.widgets),
  };
}

function mapCampaignDashboardWidgets(
  widgets: CampaignSummaryResponse['widgets'] = {}
): CampaignSummary['widgets'] {
  const population = widgets.population ?? {};
  const unsponsoredGifts = widgets.unsponsored_gifts ?? {};
  return {
    population: {
      children: Number(population.children ?? 0),
      adults: Number(population.adults ?? 0),
      gifts: Number(population.gifts ?? 0),
      unsponsoredGifts: Number(population.unsponsored_gifts ?? 0),
    },
    popularGiftsByGender: (widgets.popular_gifts_by_gender ?? []).map((item) => ({
      gender: item.gender ?? 'Unknown',
      gift: item.gift ?? 'Unspecified',
      quantity: Number(item.quantity ?? 0),
      requestCount: Number(item.request_count ?? 0),
    })),
    sponsorRecipientCounts: (widgets.sponsor_recipient_counts ?? []).map((item) => ({
      sponsorId: item.sponsor_id ?? '',
      sponsorName: item.sponsor_name ?? 'Sponsor',
      email: item.email ?? null,
      recipientCount: Number(item.recipient_count ?? 0),
      giftCount: Number(item.gift_count ?? 0),
    })),
    unsponsoredGifts: {
      count: Number(unsponsoredGifts.count ?? 0),
      items: (unsponsoredGifts.items ?? []).map((item) => ({
        wishlistItemId: item.wishlist_item_id ?? '',
        gift: item.gift ?? 'Gift',
        category: item.category ?? null,
        recipientName: item.recipient_name ?? null,
        groupName: item.group_name ?? null,
      })),
    },
    continueWhereLeftOff: (widgets.continue_where_left_off ?? []).map((item) => ({
      promptLogId: item.prompt_log_id ?? '',
      prompt: item.prompt ?? '',
      resultKind: item.result_kind ?? '',
      resultKey: item.result_key ?? null,
      title: item.title ?? null,
      createdAt: item.created_at ?? null,
    })),
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
    publicSponsorSlug: campaign.public_sponsor_slug,
    publicSponsorSignupEnabled: campaign.public_sponsor_signup_enabled,
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
    public_sponsor_slug: input.publicSponsorSlug ?? null,
    public_sponsor_signup_enabled: input.publicSponsorSignupEnabled ?? false,
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
