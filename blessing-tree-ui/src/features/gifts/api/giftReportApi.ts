import { apiFetchJson } from '@/shared/api/client';
import type {
  GiftWorkflowReport,
  GiftWorkflowReportGift,
  GiftWorkflowReportRecipient,
  GiftWorkflowStatus,
} from '@/features/gifts/model/giftReportTypes';

interface GiftWorkflowReportResponse {
  campaign: {
    id: string;
    name: string;
    year: number;
  };
  gift_policy: {
    recipient_coverage_rule: GiftWorkflowReport['giftPolicy']['recipientCoverageRule'];
    recipient_coverage_required_count: number;
  };
  statuses: GiftWorkflowStatus[];
  counts: Record<string, number>;
  recipients: GiftWorkflowReportRecipientResponse[];
}

interface GiftWorkflowReportRecipientResponse {
  id: string;
  display_label: string;
  program_recipient_id: string | null;
  recipient_kind: string;
  program_type: string;
  age: number | null;
  age_unit: string | null;
  gender: string | null;
  group: {
    id: string;
    name: string;
    type: string;
  } | null;
  wishlist: {
    id: string;
    status: string;
  } | null;
  counts: Record<string, number>;
  coverage: {
    rule: GiftWorkflowReport['giftPolicy']['recipientCoverageRule'];
    required_count: number;
    sponsored_count: number;
    remaining_count: number;
    is_covered: boolean;
  };
  gifts: GiftWorkflowReportGiftResponse[];
}

interface GiftWorkflowReportGiftResponse {
  id: string;
  description: string;
  category: string | null;
  item_type: string;
  size: string | null;
  priority: string;
  status: GiftWorkflowStatus;
  quantity_requested: number;
  quantity_fulfilled: number;
  label_code: string;
  received_at: string | null;
  wrapped_at: string | null;
  picked_up_at: string | null;
  sponsor: {
    id: string;
    display_name: string;
    email: string | null;
  } | null;
}

export async function getGiftWorkflowReport(campaignId: string): Promise<GiftWorkflowReport> {
  const response = await apiFetchJson<GiftWorkflowReportResponse>(
    `/api/v1/campaigns/${campaignId}/gifts/reports/workflow`
  );
  return {
    campaign: response.campaign,
    giftPolicy: {
      recipientCoverageRule: response.gift_policy.recipient_coverage_rule,
      recipientCoverageRequiredCount: response.gift_policy.recipient_coverage_required_count,
    },
    statuses: response.statuses,
    counts: response.counts,
    recipients: response.recipients.map(mapRecipient),
  };
}

function mapRecipient(recipient: GiftWorkflowReportRecipientResponse): GiftWorkflowReportRecipient {
  return {
    id: recipient.id,
    displayLabel: recipient.display_label,
    programRecipientId: recipient.program_recipient_id,
    recipientKind: recipient.recipient_kind,
    programType: recipient.program_type,
    age: recipient.age,
    ageUnit: recipient.age_unit,
    gender: recipient.gender,
    group: recipient.group,
    wishlist: recipient.wishlist,
    counts: recipient.counts,
    coverage: {
      rule: recipient.coverage.rule,
      requiredCount: recipient.coverage.required_count,
      sponsoredCount: recipient.coverage.sponsored_count,
      remainingCount: recipient.coverage.remaining_count,
      isCovered: recipient.coverage.is_covered,
    },
    gifts: recipient.gifts.map(mapGift),
  };
}

function mapGift(gift: GiftWorkflowReportGiftResponse): GiftWorkflowReportGift {
  return {
    id: gift.id,
    description: gift.description,
    category: gift.category,
    itemType: gift.item_type,
    size: gift.size,
    priority: gift.priority,
    status: gift.status,
    quantityRequested: gift.quantity_requested,
    quantityFulfilled: gift.quantity_fulfilled,
    labelCode: gift.label_code,
    receivedAt: gift.received_at,
    wrappedAt: gift.wrapped_at,
    pickedUpAt: gift.picked_up_at,
    sponsor: gift.sponsor
      ? {
          id: gift.sponsor.id,
          displayName: gift.sponsor.display_name,
          email: gift.sponsor.email,
        }
      : null,
  };
}
