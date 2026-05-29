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

export interface CampaignPopulationWidget {
  children: number;
  adults: number;
  gifts: number;
  unsponsoredGifts: number;
}

export interface PopularGiftByGenderWidget {
  gender: string;
  gift: string;
  quantity: number;
  requestCount: number;
}

export interface SponsorRecipientCountWidget {
  sponsorId: string;
  sponsorName: string;
  email: string | null;
  recipientCount: number;
  giftCount: number;
}

export interface UnsponsoredGiftWidgetItem {
  wishlistItemId: string;
  gift: string;
  category: string | null;
  recipientName: string | null;
  groupName: string | null;
}

export interface UnsponsoredGiftWidget {
  count: number;
  items: UnsponsoredGiftWidgetItem[];
}

export interface ContinueWhereLeftOffWidgetItem {
  promptLogId: string;
  prompt: string;
  resultKind: string;
  resultKey: string | null;
  title: string | null;
  createdAt: string | null;
}

export interface CalendarUpcomingWidgetItem {
  id: string;
  title: string;
  date: string | null;
  urgency: string;
  itemType: string;
  isBlocker: boolean;
  count: number | null;
  routeName: string | null;
}

export interface CalendarUpcomingWidget {
  totalCount: number;
  dueSoonCount: number;
  scheduledCommunicationsCount: number;
  items: CalendarUpcomingWidgetItem[];
}

export interface CampaignDashboardWidgets {
  population: CampaignPopulationWidget;
  popularGiftsByGender: PopularGiftByGenderWidget[];
  sponsorRecipientCounts: SponsorRecipientCountWidget[];
  unsponsoredGifts: UnsponsoredGiftWidget;
  continueWhereLeftOff: ContinueWhereLeftOffWidgetItem[];
  calendarUpcoming: CalendarUpcomingWidget;
}

export interface CampaignSummary {
  campaignId: string;
  counts: CampaignSummaryCounts;
  widgets: CampaignDashboardWidgets;
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
