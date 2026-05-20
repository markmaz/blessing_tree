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
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignListItem extends Campaign {
  userAccess: CampaignAccess;
}
