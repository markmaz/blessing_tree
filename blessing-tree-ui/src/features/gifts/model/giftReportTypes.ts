export type GiftWorkflowStatus =
  | 'OPEN'
  | 'RESERVED'
  | 'COMMITTED'
  | 'RECEIVED'
  | 'WRAPPED'
  | 'TAGGED'
  | 'READY_FOR_DISTRIBUTION'
  | 'DISTRIBUTED'
  | 'PICKED_UP'
  | 'EXCEPTION'
  | 'CANCELLED';

export interface GiftWorkflowReport {
  campaign: {
    id: string;
    name: string;
    year: number;
  };
  giftPolicy: {
    recipientCoverageRule: 'ONE_GIFT_SPONSORED' | 'MIN_GIFTS_SPONSORED' | 'ALL_GIFTS_SPONSORED';
    recipientCoverageRequiredCount: number;
  };
  statuses: GiftWorkflowStatus[];
  counts: Record<string, number>;
  recipients: GiftWorkflowReportRecipient[];
}

export interface GiftWorkflowReportRecipient {
  id: string;
  displayLabel: string;
  programRecipientId: string | null;
  recipientKind: string;
  programType: string;
  age: number | null;
  ageUnit: string | null;
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
    requiredCount: number;
    sponsoredCount: number;
    remainingCount: number;
    isCovered: boolean;
  };
  gifts: GiftWorkflowReportGift[];
}

export interface GiftWorkflowReportGift {
  id: string;
  description: string;
  category: string | null;
  itemType: string;
  size: string | null;
  priority: string;
  status: GiftWorkflowStatus;
  quantityRequested: number;
  quantityFulfilled: number;
  labelCode: string;
  receivedAt: string | null;
  wrappedAt: string | null;
  pickedUpAt: string | null;
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
  } | null;
}
