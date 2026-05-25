import { apiFetchJson } from '@/shared/api/client';
import type {
  GiftPoolAssignment,
  GiftPoolDonation,
  GiftPoolDonationInput,
  GiftPoolLine,
  GiftPoolLineInput,
  GiftPoolMatch,
  GiftPoolResult,
} from '@/features/gifts/model/giftPoolTypes';
import type { GiftSearchItem } from '@/features/gifts/model/giftSearchTypes';

interface GiftPoolLineResponse {
  id: string;
  donation_id: string;
  campaign_id: string;
  line_type: string;
  description: string;
  category: string | null;
  size: string | null;
  quantity: number;
  quantity_available: number;
  quantity_assigned: number;
  estimated_value_cents: number | null;
  age_min: number | null;
  age_max: number | null;
  gender_fit: string;
  gift_condition: string;
  source_label: string | null;
  storage_location_id: string | null;
  status: string;
  inventory_status: string;
  received_by_user_id: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  donation: {
    id: string;
    source: string;
    received_at: string | null;
    notes: string | null;
    sponsor_id: string | null;
  };
  assignments: GiftPoolAssignmentResponse[];
}

interface GiftPoolAssignmentResponse {
  id: string;
  wishlist_item_id: string;
  donation_line_id: string;
  quantity_fulfilled: number;
  fulfilled_at: string | null;
  fulfilled_by_user_id: string | null;
  notes: string | null;
}

interface GiftPoolDonationResponse {
  id: string;
  campaign_id: string;
  sponsor_id: string | null;
  source: string;
  received_at: string | null;
  received_by_user_id: string | null;
  notes: string | null;
  lines: GiftPoolLineResponse[];
}

interface GiftPoolResponse {
  campaign_id: string;
  counts: Record<string, number>;
  lines: GiftPoolLineResponse[];
}

interface GiftPoolMatchResponse {
  wishlist_item: GiftSearchItemResponse;
  score: number;
  reasons: string[];
}

interface GiftSearchItemResponse {
  wishlist_item_id: string;
  description: string;
  category: string | null;
  item_type: string;
  size: string | null;
  qty_requested: number;
  qty_fulfilled: number;
  qty_remaining: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  estimated_cost_cents: number | null;
  allow_substitute: boolean;
  status: string;
  is_available: boolean;
  sponsorship_status: 'SPONSORED' | 'UNSPONSORED';
  recipient: {
    id: string;
    display_label?: string;
    public_label?: string;
    program_recipient_id?: string | null;
    recipient_kind: string;
    program_type: string;
    age: number | null;
    age_unit: string | null;
    gender: string | null;
  } | null;
  label_code?: string;
  recipient_note?: string | null;
  notes?: string | null;
}

export async function getCampaignGiftPool(
  campaignId: string,
  filters: { status?: string; search?: string } = {}
): Promise<GiftPoolResult> {
  const params = new URLSearchParams();
  if (filters.status?.trim()) {
    params.set('status', filters.status.trim());
  }
  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await apiFetchJson<GiftPoolResponse>(`/api/v1/campaigns/${campaignId}/gift-pool${suffix}`);
  return {
    campaignId: response.campaign_id,
    counts: response.counts,
    lines: response.lines.map(mapGiftPoolLine),
  };
}

export async function createCampaignDonation(
  campaignId: string,
  input: GiftPoolDonationInput
): Promise<GiftPoolDonation> {
  const response = await apiFetchJson<{ donation: GiftPoolDonationResponse }>(
    `/api/v1/campaigns/${campaignId}/donations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapDonationInput(input)),
    }
  );
  return mapGiftPoolDonation(response.donation);
}

export async function getGiftPoolMatches(campaignId: string, lineId: string): Promise<GiftPoolMatch[]> {
  const response = await apiFetchJson<{ matches: GiftPoolMatchResponse[] }>(
    `/api/v1/campaigns/${campaignId}/donation-lines/${lineId}/matches`
  );
  return response.matches.map((match) => ({
    wishlistItem: mapGiftSearchItem(match.wishlist_item),
    score: match.score,
    reasons: match.reasons,
  }));
}

export async function assignGiftPoolLine(
  campaignId: string,
  lineId: string,
  input: { wishlistItemId: string; quantity: number; notes?: string }
): Promise<{ line: GiftPoolLine; gift: GiftSearchItem; assignment: GiftPoolAssignment }> {
  const response = await apiFetchJson<{
    line: GiftPoolLineResponse;
    gift: GiftSearchItemResponse;
    fulfillment: GiftPoolAssignmentResponse;
  }>(`/api/v1/campaigns/${campaignId}/donation-lines/${lineId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wishlist_item_id: input.wishlistItemId,
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
    }),
  });
  return {
    line: mapGiftPoolLine(response.line),
    gift: mapGiftSearchItem(response.gift),
    assignment: mapGiftPoolAssignment(response.fulfillment),
  };
}

function mapDonationInput(input: GiftPoolDonationInput) {
  return {
    source: input.source,
    sponsor_id: input.sponsorId || null,
    notes: input.notes?.trim() || null,
    lines: input.lines.map(mapLineInput),
  };
}

function mapLineInput(input: GiftPoolLineInput) {
  return {
    description: input.description,
    line_type: input.lineType ?? 'GOODS',
    category: input.category || null,
    size: input.size || null,
    quantity: input.quantity ?? 1,
    estimated_value_cents: input.estimatedValueCents ?? null,
    age_min: input.ageMin ?? null,
    age_max: input.ageMax ?? null,
    gender_fit: input.genderFit ?? 'ANY',
    gift_condition: input.giftCondition ?? 'NEW',
    source_label: input.sourceLabel || null,
    notes: input.notes || null,
  };
}

function mapGiftPoolDonation(donation: GiftPoolDonationResponse): GiftPoolDonation {
  return {
    id: donation.id,
    campaignId: donation.campaign_id,
    sponsorId: donation.sponsor_id,
    source: donation.source,
    receivedAt: donation.received_at,
    receivedByUserId: donation.received_by_user_id,
    notes: donation.notes,
    lines: donation.lines.map(mapGiftPoolLine),
  };
}

function mapGiftPoolLine(line: GiftPoolLineResponse): GiftPoolLine {
  return {
    id: line.id,
    donationId: line.donation_id,
    campaignId: line.campaign_id,
    lineType: line.line_type,
    description: line.description,
    category: line.category,
    size: line.size,
    quantity: line.quantity,
    quantityAvailable: line.quantity_available,
    quantityAssigned: line.quantity_assigned,
    estimatedValueCents: line.estimated_value_cents,
    ageMin: line.age_min,
    ageMax: line.age_max,
    genderFit: line.gender_fit,
    giftCondition: line.gift_condition,
    sourceLabel: line.source_label,
    storageLocationId: line.storage_location_id,
    status: line.status,
    inventoryStatus: line.inventory_status,
    receivedByUserId: line.received_by_user_id,
    notes: line.notes,
    createdAt: line.created_at,
    updatedAt: line.updated_at,
    donation: {
      id: line.donation.id,
      source: line.donation.source,
      receivedAt: line.donation.received_at,
      notes: line.donation.notes,
      sponsorId: line.donation.sponsor_id,
    },
    assignments: line.assignments.map(mapGiftPoolAssignment),
  };
}

function mapGiftPoolAssignment(assignment: GiftPoolAssignmentResponse): GiftPoolAssignment {
  return {
    id: assignment.id,
    wishlistItemId: assignment.wishlist_item_id,
    donationLineId: assignment.donation_line_id,
    quantityFulfilled: assignment.quantity_fulfilled,
    fulfilledAt: assignment.fulfilled_at,
    fulfilledByUserId: assignment.fulfilled_by_user_id,
    notes: assignment.notes,
  };
}

function mapGiftSearchItem(item: GiftSearchItemResponse): GiftSearchItem {
  return {
    wishlistItemId: item.wishlist_item_id,
    description: item.description,
    category: item.category,
    itemType: item.item_type,
    size: item.size,
    qtyRequested: item.qty_requested,
    qtyFulfilled: item.qty_fulfilled,
    qtyRemaining: item.qty_remaining,
    priority: item.priority,
    estimatedCostCents: item.estimated_cost_cents,
    allowSubstitute: item.allow_substitute,
    status: item.status,
    isAvailable: item.is_available,
    sponsorshipStatus: item.sponsorship_status,
    recipient: item.recipient
      ? {
          id: item.recipient.id,
          displayLabel: item.recipient.display_label,
          publicLabel: item.recipient.public_label,
          programRecipientId: item.recipient.program_recipient_id,
          recipientKind: item.recipient.recipient_kind,
          programType: item.recipient.program_type,
          age: item.recipient.age,
          ageUnit: item.recipient.age_unit,
          gender: item.recipient.gender,
        }
      : null,
    labelCode: item.label_code,
    recipientNote: item.recipient_note,
    notes: item.notes,
  };
}
