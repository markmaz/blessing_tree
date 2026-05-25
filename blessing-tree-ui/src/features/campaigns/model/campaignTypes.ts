export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export interface CampaignAccess {
  campaignId: string;
  globalAppRole: string;
  roleKeys: string[];
  capabilities: string[];
}

export interface CampaignSummaryCounts {
  recipientGroups: number;
  recipients: number;
  wishlists: number;
  wishlistItems: number;
  donations: number;
  sponsorships: number;
  sponsorshipItems: number;
  fulfillments: number;
  pickups: number;
}

export interface CampaignSummary {
  campaignId: string;
  counts: CampaignSummaryCounts;
}

export interface Campaign {
  id: string;
  name: string;
  year: number;
  description: string | null;
  seasonTheme: string | null;
  publicSponsorSlug: string | null;
  publicSponsorSignupEnabled: boolean;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignListItem extends Campaign {
  userAccess: CampaignAccess;
}

export interface CampaignUpsertInput {
  name: string;
  year: number;
  description: string | null;
  seasonTheme: string | null;
  publicSponsorSlug?: string | null;
  publicSponsorSignupEnabled?: boolean;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  sourceCampaignId?: string | null;
}

export interface SeasonReflectionVerse {
  id: string;
  reference: string;
  translation: string;
  text: string;
  tags: string[];
}

export interface SeasonReflectionPrayer {
  id: string;
  title: string;
  citation: string;
  text: string;
  tags: string[];
}

export interface CampaignSeasonReflection {
  campaignId: string;
  seasonTheme: string | null;
  source: 'llm' | 'fallback';
  fallbackReason: string | null;
  pairId: string;
  verse: SeasonReflectionVerse;
  prayer: SeasonReflectionPrayer;
}
