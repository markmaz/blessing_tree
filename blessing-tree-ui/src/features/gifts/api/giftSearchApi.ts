import { apiFetchJson } from '@/shared/api/client';
import type {
  GiftLabelPayload,
  GiftLabelPrintJob,
  GiftOperationsAction,
  GiftOperationsItem,
  GiftOperationsResult,
  GiftReminderAudience,
  GiftReminderMilestoneOption,
  GiftReminderPreview,
  GiftReminderRule,
  GiftReminderRulesResult,
  GiftReminderSendResult,
  GiftReminderTemplateOption,
  PublicGiftScanLookup,
  GiftScanAction,
  GiftScanLookup,
  GiftSearchItem,
  GiftSearchParsedFilters,
  GiftSearchResult,
} from '@/features/gifts/model/giftSearchTypes';

interface GiftSearchParsedFiltersResponse {
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
  received_at?: string | null;
  wrapped_at?: string | null;
  storage_location_id?: string | null;
  sponsor?: {
    id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    sponsorship_id: string;
    drop_off_status: string;
  } | null;
}

interface GiftLabelPrintItemResponse {
  id: string;
  label_print_job_id: string;
  wishlist_item_id: string;
  copies: number;
  label: GiftLabelPayload;
  gift: GiftSearchItemResponse;
}

interface GiftLabelPrintJobResponse {
  id: string;
  campaign_id: string;
  printed_by_user_id: string | null;
  printed_at: string | null;
  format: string;
  printer_name: string | null;
  notes: string | null;
  items: GiftLabelPrintItemResponse[];
}

interface GiftScanLookupResponse {
  gift: GiftSearchItemResponse;
  scan_path: string;
  available_actions: GiftScanAction[];
}

interface PublicGiftScanLookupResponse {
  campaign: {
    id: string;
    name: string;
    year: number;
  };
  gift: {
    wishlist_item_id: string;
    description: string;
    category: string | null;
    item_type: string;
    size: string | null;
    status: string;
    label_code: string;
  };
  recipient: {
    id: string;
    display_label: string;
    program_recipient_id: string | null;
    recipient_kind: string;
    program_type: string;
    group_label: string | null;
  } | null;
  scan_path: string;
  available_actions: GiftScanAction[];
}

interface GiftSearchResponse {
  campaign_id: string;
  parsed_filters: GiftSearchParsedFiltersResponse;
  count: number;
  items: GiftSearchItemResponse[];
}

interface GiftOperationsResponse {
  campaign_id: string;
  counts: Record<string, number>;
  items: GiftSearchItemResponse[];
}

interface GiftReminderRuleResponse {
  id: string;
  campaign_id: string;
  rule_key: string;
  label: string;
  is_enabled: boolean;
  audience: GiftReminderAudience;
  milestone_key: string | null;
  offset_days: number;
  send_time_local: string;
  template_id: string | null;
  channel: 'EMAIL';
  suppress_if_all_received: boolean;
  last_evaluated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface GiftReminderRulesResponse {
  campaign_id: string;
  rules: GiftReminderRuleResponse[];
  template_options: Array<{
    id: string;
    name: string;
    template_key: string;
    subject_template: string;
  }>;
  milestone_options: Array<{
    milestone_key: string;
    label: string;
    occurs_on: string;
  }>;
}

interface GiftReminderPreviewResponse {
  rule_id: string;
  campaign_id: string;
  due_at: string | null;
  is_due: boolean;
  recipient_count: number;
  recipients: Array<{
    sponsor: {
      id: string;
      display_name: string;
      email: string | null;
      do_not_contact: boolean;
    };
    sponsorship_id: string;
    gift_count: number;
    gifts: GiftSearchItemResponse[];
  }>;
}

interface GiftReminderSendResponse {
  rule_id: string;
  status: string;
  due_at?: string | null;
  recipient_count: number;
  sent_count?: number;
  skipped_count?: number;
  failed_count?: number;
  errors?: string[];
}

export async function searchCampaignGifts(campaignId: string, query: string): Promise<GiftSearchResult> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await apiFetchJson<GiftSearchResponse>(`/api/v1/campaigns/${campaignId}/gifts/search${suffix}`);
  return mapGiftSearchResult(response);
}

export async function searchPublicCampaignGifts(publicSlug: string, query: string): Promise<GiftSearchResult> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await apiFetchJson<GiftSearchResponse>(`/api/v1/public/campaigns/${publicSlug}/gifts/search${suffix}`);
  return mapGiftSearchResult(response);
}

export async function commitCampaignGift(
  campaignId: string,
  wishlistItemId: string,
  sponsorId: string,
  notes?: string
): Promise<GiftSearchItem> {
  const response = await apiFetchJson<{ gift: GiftSearchItemResponse }>(
    `/api/v1/campaigns/${campaignId}/gifts/${wishlistItemId}/commit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sponsor_id: sponsorId,
        notes: notes?.trim() || null,
      }),
    }
  );
  return mapGiftSearchItem(response.gift);
}

export async function releaseCampaignGift(campaignId: string, wishlistItemId: string): Promise<GiftSearchItem> {
  const response = await apiFetchJson<{ gift: GiftSearchItemResponse }>(
    `/api/v1/campaigns/${campaignId}/gifts/${wishlistItemId}/release`,
    {
      method: 'POST',
    }
  );
  return mapGiftSearchItem(response.gift);
}

export async function getCampaignGiftOperations(
  campaignId: string,
  filters: { status?: string; search?: string } = {}
): Promise<GiftOperationsResult> {
  const params = new URLSearchParams();
  if (filters.status?.trim()) {
    params.set('status', filters.status.trim());
  }
  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await apiFetchJson<GiftOperationsResponse>(`/api/v1/campaigns/${campaignId}/gifts/operations${suffix}`);
  return {
    campaignId: response.campaign_id,
    counts: response.counts,
    items: response.items.map(mapGiftOperationsItem),
  };
}

export async function updateCampaignGiftOperation(
  campaignId: string,
  wishlistItemId: string,
  action: GiftOperationsAction,
  notes?: string
): Promise<GiftOperationsItem> {
  const response = await apiFetchJson<{ gift: GiftSearchItemResponse }>(
    `/api/v1/campaigns/${campaignId}/gifts/${wishlistItemId}/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: notes?.trim() || null,
      }),
    }
  );
  return mapGiftOperationsItem(response.gift);
}

export async function createGiftLabelPrintJob(
  campaignId: string,
  input: { wishlistItemIds: string[]; copies?: number; format?: string; notes?: string }
): Promise<GiftLabelPrintJob> {
  const response = await apiFetchJson<{ print_job: GiftLabelPrintJobResponse }>(
    `/api/v1/campaigns/${campaignId}/gift-labels/print-jobs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wishlist_item_ids: input.wishlistItemIds,
        copies: input.copies ?? 1,
        format: input.format ?? 'TAG',
        notes: input.notes?.trim() || null,
      }),
    }
  );
  return mapGiftLabelPrintJob(response.print_job);
}

export async function getGiftScanLookup(campaignId: string, labelCode: string): Promise<GiftScanLookup> {
  const response = await apiFetchJson<GiftScanLookupResponse>(
    `/api/v1/campaigns/${campaignId}/gifts/scan/${encodeURIComponent(labelCode)}`
  );
  return mapGiftScanLookup(response);
}

export async function getPublicGiftScanLookup(labelCode: string): Promise<PublicGiftScanLookup> {
  const response = await apiFetchJson<PublicGiftScanLookupResponse>(
    `/api/v1/public/gifts/scan/${encodeURIComponent(labelCode)}`,
    { retryOnUnauthorized: false }
  );
  return mapPublicGiftScanLookup(response);
}

export async function listGiftReminderRules(campaignId: string): Promise<GiftReminderRulesResult> {
  const response = await apiFetchJson<GiftReminderRulesResponse>(`/api/v1/campaigns/${campaignId}/gift-reminder-rules`);
  return {
    campaignId: response.campaign_id,
    rules: response.rules.map(mapGiftReminderRule),
    templateOptions: response.template_options.map(mapGiftReminderTemplateOption),
    milestoneOptions: response.milestone_options.map(mapGiftReminderMilestoneOption),
  };
}

export async function createGiftReminderRule(
  campaignId: string,
  input: {
    label: string;
    audience: GiftReminderAudience;
    milestoneKey: string | null;
    offsetDays: number;
    sendTimeLocal: string;
    templateId: string | null;
    isEnabled: boolean;
    suppressIfAllReceived: boolean;
  }
): Promise<GiftReminderRule> {
  const response = await apiFetchJson<{ rule: GiftReminderRuleResponse }>(
    `/api/v1/campaigns/${campaignId}/gift-reminder-rules`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(giftReminderRulePayload(input)),
    }
  );
  return mapGiftReminderRule(response.rule);
}

export async function updateGiftReminderRule(
  campaignId: string,
  ruleId: string,
  input: Partial<{
    label: string;
    audience: GiftReminderAudience;
    milestoneKey: string | null;
    offsetDays: number;
    sendTimeLocal: string;
    templateId: string | null;
    isEnabled: boolean;
    suppressIfAllReceived: boolean;
  }>
): Promise<GiftReminderRule> {
  const response = await apiFetchJson<{ rule: GiftReminderRuleResponse }>(
    `/api/v1/campaigns/${campaignId}/gift-reminder-rules/${ruleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(giftReminderRulePayload(input)),
    }
  );
  return mapGiftReminderRule(response.rule);
}

export async function previewGiftReminderRule(campaignId: string, ruleId: string): Promise<GiftReminderPreview> {
  const response = await apiFetchJson<GiftReminderPreviewResponse>(
    `/api/v1/campaigns/${campaignId}/gift-reminder-rules/${ruleId}/preview`,
    { method: 'POST' }
  );
  return mapGiftReminderPreview(response);
}

export async function sendGiftReminderRule(campaignId: string, ruleId: string): Promise<GiftReminderSendResult> {
  const response = await apiFetchJson<GiftReminderSendResponse>(
    `/api/v1/campaigns/${campaignId}/gift-reminder-rules/${ruleId}/send`,
    { method: 'POST' }
  );
  return {
    ruleId: response.rule_id,
    status: response.status,
    dueAt: response.due_at,
    recipientCount: response.recipient_count,
    sentCount: response.sent_count,
    skippedCount: response.skipped_count,
    failedCount: response.failed_count,
    errors: response.errors,
  };
}

export async function updateGiftScanAction(
  campaignId: string,
  labelCode: string,
  action: GiftScanAction,
  notes?: string
): Promise<GiftScanLookup> {
  const response = await apiFetchJson<GiftScanLookupResponse>(
    `/api/v1/campaigns/${campaignId}/gifts/scan/${encodeURIComponent(labelCode)}/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        notes: notes?.trim() || null,
      }),
    }
  );
  return mapGiftScanLookup(response);
}

export async function updatePublicGiftScanAction(
  labelCode: string,
  action: GiftScanAction,
  notes?: string
): Promise<PublicGiftScanLookup> {
  const response = await apiFetchJson<PublicGiftScanLookupResponse>(
    `/api/v1/public/gifts/scan/${encodeURIComponent(labelCode)}/actions`,
    {
      method: 'POST',
      retryOnUnauthorized: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        notes: notes?.trim() || null,
      }),
    }
  );
  return mapPublicGiftScanLookup(response);
}

function mapGiftSearchResult(response: GiftSearchResponse): GiftSearchResult {
  return {
    campaignId: response.campaign_id,
    parsedFilters: mapParsedFilters(response.parsed_filters),
    count: response.count,
    items: response.items.map(mapGiftSearchItem),
  };
}

function mapParsedFilters(filters: GiftSearchParsedFiltersResponse): GiftSearchParsedFilters {
  return {
    query: filters.query,
    age_min: filters.age_min,
    age_max: filters.age_max,
    gender: filters.gender,
    categories: filters.categories,
    item_types: filters.item_types,
    sizes: filters.sizes,
    min_cost_cents: filters.min_cost_cents,
    max_cost_cents: filters.max_cost_cents,
    terms: filters.terms,
    warnings: filters.warnings,
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

function mapGiftOperationsItem(item: GiftSearchItemResponse): GiftOperationsItem {
  return {
    ...mapGiftSearchItem(item),
    receivedAt: item.received_at ?? null,
    wrappedAt: item.wrapped_at ?? null,
    storageLocationId: item.storage_location_id ?? null,
    sponsor: item.sponsor
      ? {
          id: item.sponsor.id,
          displayName: item.sponsor.display_name,
          email: item.sponsor.email,
          phone: item.sponsor.phone,
          sponsorshipId: item.sponsor.sponsorship_id,
          dropOffStatus: item.sponsor.drop_off_status,
        }
      : null,
  };
}

function mapGiftLabelPrintJob(job: GiftLabelPrintJobResponse): GiftLabelPrintJob {
  return {
    id: job.id,
    campaignId: job.campaign_id,
    printedByUserId: job.printed_by_user_id,
    printedAt: job.printed_at,
    format: job.format,
    printerName: job.printer_name,
    notes: job.notes,
    items: job.items.map((item) => ({
      id: item.id,
      labelPrintJobId: item.label_print_job_id,
      wishlistItemId: item.wishlist_item_id,
      copies: item.copies,
      label: item.label,
      gift: mapGiftOperationsItem(item.gift),
    })),
  };
}

function mapGiftScanLookup(response: GiftScanLookupResponse): GiftScanLookup {
  return {
    gift: mapGiftOperationsItem(response.gift),
    scanPath: response.scan_path,
    availableActions: response.available_actions,
  };
}

function mapPublicGiftScanLookup(response: PublicGiftScanLookupResponse): PublicGiftScanLookup {
  return {
    campaign: response.campaign,
    gift: {
      wishlistItemId: response.gift.wishlist_item_id,
      description: response.gift.description,
      category: response.gift.category,
      itemType: response.gift.item_type,
      size: response.gift.size,
      status: response.gift.status,
      labelCode: response.gift.label_code,
    },
    recipient: response.recipient
      ? {
          id: response.recipient.id,
          displayLabel: response.recipient.display_label,
          programRecipientId: response.recipient.program_recipient_id,
          recipientKind: response.recipient.recipient_kind,
          programType: response.recipient.program_type,
          groupLabel: response.recipient.group_label,
        }
      : null,
    scanPath: response.scan_path,
    availableActions: response.available_actions,
  };
}

function mapGiftReminderRule(rule: GiftReminderRuleResponse): GiftReminderRule {
  return {
    id: rule.id,
    campaignId: rule.campaign_id,
    ruleKey: rule.rule_key,
    label: rule.label,
    isEnabled: rule.is_enabled,
    audience: rule.audience,
    milestoneKey: rule.milestone_key,
    offsetDays: rule.offset_days,
    sendTimeLocal: rule.send_time_local,
    templateId: rule.template_id,
    channel: rule.channel,
    suppressIfAllReceived: rule.suppress_if_all_received,
    lastEvaluatedAt: rule.last_evaluated_at,
    createdAt: rule.created_at,
    updatedAt: rule.updated_at,
  };
}

function mapGiftReminderTemplateOption(option: GiftReminderRulesResponse['template_options'][number]): GiftReminderTemplateOption {
  return {
    id: option.id,
    name: option.name,
    templateKey: option.template_key,
    subjectTemplate: option.subject_template,
  };
}

function mapGiftReminderMilestoneOption(option: GiftReminderRulesResponse['milestone_options'][number]): GiftReminderMilestoneOption {
  return {
    milestoneKey: option.milestone_key,
    label: option.label,
    occursOn: option.occurs_on,
  };
}

function mapGiftReminderPreview(response: GiftReminderPreviewResponse): GiftReminderPreview {
  return {
    ruleId: response.rule_id,
    campaignId: response.campaign_id,
    dueAt: response.due_at,
    isDue: response.is_due,
    recipientCount: response.recipient_count,
    recipients: response.recipients.map((recipient) => ({
      sponsor: {
        id: recipient.sponsor.id,
        displayName: recipient.sponsor.display_name,
        email: recipient.sponsor.email,
        doNotContact: recipient.sponsor.do_not_contact,
      },
      sponsorshipId: recipient.sponsorship_id,
      giftCount: recipient.gift_count,
      gifts: recipient.gifts.map(mapGiftOperationsItem),
    })),
  };
}

function giftReminderRulePayload(
  input: Partial<{
    label: string;
    audience: GiftReminderAudience;
    milestoneKey: string | null;
    offsetDays: number;
    sendTimeLocal: string;
    templateId: string | null;
    isEnabled: boolean;
    suppressIfAllReceived: boolean;
  }>
) {
  return {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.audience !== undefined ? { audience: input.audience } : {}),
    ...(input.milestoneKey !== undefined ? { milestone_key: input.milestoneKey } : {}),
    ...(input.offsetDays !== undefined ? { offset_days: input.offsetDays } : {}),
    ...(input.sendTimeLocal !== undefined ? { send_time_local: input.sendTimeLocal } : {}),
    ...(input.templateId !== undefined ? { template_id: input.templateId } : {}),
    ...(input.isEnabled !== undefined ? { is_enabled: input.isEnabled } : {}),
    ...(input.suppressIfAllReceived !== undefined ? { suppress_if_all_received: input.suppressIfAllReceived } : {}),
  };
}
