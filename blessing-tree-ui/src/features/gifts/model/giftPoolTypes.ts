import type { GiftSearchItem } from '@/features/gifts/model/giftSearchTypes';

export interface GiftPoolDonationSummary {
  id: string;
  source: string;
  receivedAt: string | null;
  notes: string | null;
  sponsorId: string | null;
}

export interface GiftPoolAssignment {
  id: string;
  wishlistItemId: string;
  donationLineId: string;
  quantityFulfilled: number;
  fulfilledAt: string | null;
  fulfilledByUserId: string | null;
  notes: string | null;
}

export interface GiftPoolLine {
  id: string;
  donationId: string;
  campaignId: string;
  lineType: string;
  description: string;
  category: string | null;
  size: string | null;
  quantity: number;
  quantityAvailable: number;
  quantityAssigned: number;
  estimatedValueCents: number | null;
  ageMin: number | null;
  ageMax: number | null;
  genderFit: string;
  giftCondition: string;
  sourceLabel: string | null;
  storageLocationId: string | null;
  status: string;
  inventoryStatus: string;
  receivedByUserId: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  donation: GiftPoolDonationSummary;
  assignments: GiftPoolAssignment[];
}

export interface GiftPoolDonation {
  id: string;
  campaignId: string;
  sponsorId: string | null;
  source: string;
  receivedAt: string | null;
  receivedByUserId: string | null;
  notes: string | null;
  lines: GiftPoolLine[];
}

export interface GiftPoolResult {
  campaignId: string;
  counts: Record<string, number>;
  lines: GiftPoolLine[];
}

export interface GiftPoolMatch {
  wishlistItem: GiftSearchItem;
  score: number;
  reasons: string[];
}

export interface GiftPoolLineInput {
  description: string;
  lineType?: string;
  category?: string | null;
  size?: string | null;
  quantity?: number;
  estimatedValueCents?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
  genderFit?: string;
  giftCondition?: string;
  sourceLabel?: string | null;
  notes?: string | null;
}

export interface GiftPoolDonationInput {
  source: string;
  sponsorId?: string | null;
  notes?: string | null;
  lines: GiftPoolLineInput[];
}
