export interface GiftSearchParsedFilters {
  query: string;
  age_min: number | null;
  age_max: number | null;
  gender: string | null;
  categories: string[];
  item_types: string[];
  sizes: string[];
  min_cost_cents: number | null;
  max_cost_cents: number | null;
  terms: string[];
  warnings: string[];
}

export interface GiftSearchRecipient {
  id: string;
  displayLabel?: string;
  publicLabel?: string;
  programRecipientId?: string | null;
  recipientKind: string;
  programType: string;
  age: number | null;
  ageUnit: string | null;
  gender: string | null;
}

export interface GiftSearchItem {
  wishlistItemId: string;
  description: string;
  category: string | null;
  itemType: string;
  size: string | null;
  qtyRequested: number;
  qtyFulfilled: number;
  qtyRemaining: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedCostCents: number | null;
  allowSubstitute: boolean;
  status: string;
  isAvailable: boolean;
  sponsorshipStatus: 'SPONSORED' | 'UNSPONSORED';
  recipient: GiftSearchRecipient | null;
  labelCode?: string;
  recipientNote?: string | null;
  notes?: string | null;
}

export interface GiftSearchResult {
  campaignId: string;
  parsedFilters: GiftSearchParsedFilters;
  count: number;
  items: GiftSearchItem[];
}

export interface GiftOperationsSponsor {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  sponsorshipId: string;
  dropOffStatus: string;
}

export interface GiftOperationsItem extends GiftSearchItem {
  receivedAt: string | null;
  wrappedAt: string | null;
  storageLocationId: string | null;
  sponsor: GiftOperationsSponsor | null;
}

export interface GiftOperationsResult {
  campaignId: string;
  counts: Record<string, number>;
  items: GiftOperationsItem[];
}

export type GiftOperationsAction = 'receive' | 'wrap' | 'ready' | 'pickup' | 'exception';

export interface GiftLabelPayload {
  campaign: {
    name: string;
    year: number;
  };
  recipient: {
    display_label: string | null;
    program_recipient_id: string | null;
    group_label: string | null;
    age?: number | null;
    age_unit?: string | null;
    gender?: string | null;
  };
  gift: {
    description: string;
    category: string | null;
    size: string | null;
    label_code: string;
  };
  theme?: {
    purpose: string | null;
    icon: string;
    accent: string;
  };
  scan_path: string;
}

export interface GiftLabelPrintItem {
  id: string;
  labelPrintJobId: string;
  wishlistItemId: string;
  copies: number;
  label: GiftLabelPayload;
  gift: GiftOperationsItem;
}

export interface GiftLabelPrintJob {
  id: string;
  campaignId: string;
  printedByUserId: string | null;
  printedAt: string | null;
  format: string;
  printerName: string | null;
  notes: string | null;
  items: GiftLabelPrintItem[];
}

export interface GiftScanLookup {
  gift: GiftOperationsItem;
  scanPath: string;
  availableActions: GiftScanAction[];
}

export type GiftScanAction = 'RECEIVE' | 'WRAP' | 'READY' | 'DISTRIBUTE' | 'PICKUP' | 'EXCEPTION' | 'REPRINT';

export interface PublicGiftScanLookup {
  campaign: {
    id: string;
    name: string;
    year: number;
  };
  gift: {
    wishlistItemId: string;
    description: string;
    category: string | null;
    itemType: string;
    size: string | null;
    status: string;
    labelCode: string;
  };
  recipient: {
    id: string;
    displayLabel: string;
    programRecipientId: string | null;
    recipientKind: string;
    programType: string;
    groupLabel: string | null;
  } | null;
  scanPath: string;
  availableActions: GiftScanAction[];
}

export type GiftReminderAudience =
  | 'SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS'
  | 'SPONSORS_WITH_OVERDUE_GIFTS'
  | 'SPONSORS_WITH_RECEIVED_GIFTS';

export interface GiftReminderRule {
  id: string;
  campaignId: string;
  ruleKey: string;
  label: string;
  isEnabled: boolean;
  audience: GiftReminderAudience;
  milestoneKey: string | null;
  offsetDays: number;
  sendTimeLocal: string;
  templateId: string | null;
  channel: 'EMAIL';
  suppressIfAllReceived: boolean;
  lastEvaluatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GiftReminderTemplateOption {
  id: string;
  name: string;
  templateKey: string;
  subjectTemplate: string;
}

export interface GiftReminderMilestoneOption {
  milestoneKey: string;
  label: string;
  occursOn: string;
}

export interface GiftReminderRulesResult {
  campaignId: string;
  rules: GiftReminderRule[];
  templateOptions: GiftReminderTemplateOption[];
  milestoneOptions: GiftReminderMilestoneOption[];
}

export interface GiftReminderPreviewRecipient {
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
    doNotContact: boolean;
  };
  sponsorshipId: string;
  giftCount: number;
  gifts: GiftOperationsItem[];
}

export interface GiftReminderPreview {
  ruleId: string;
  campaignId: string;
  dueAt: string | null;
  isDue: boolean;
  recipientCount: number;
  recipients: GiftReminderPreviewRecipient[];
}

export interface GiftReminderSendResult {
  ruleId: string;
  status: string;
  dueAt?: string | null;
  recipientCount: number;
  sentCount?: number;
  skippedCount?: number;
  failedCount?: number;
  errors?: string[];
}
