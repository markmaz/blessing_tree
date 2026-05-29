import { apiFetchJson } from '@/shared/api/client';
import type {
  CampaignAddressSuggestion,
  CampaignPeopleGroup,
  CampaignPeopleGroupContact,
  CampaignPeopleWorkspaceData,
  CampaignRecipient,
  CampaignWishlist,
  CampaignWishlistItem,
  GroupContactUpsertInput,
  RecipientGroupUpsertInput,
  RecipientUpsertInput,
  WishlistItemUpsertInput,
  WishlistUpsertInput,
  OrganizationTypeOption,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

interface GroupContactResponse {
  id: string;
  recipient_group_id: string;
  display_name: string;
  contact_role: CampaignPeopleGroupContact['contactRole'];
  relationship_label: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_contact: CampaignPeopleGroupContact['preferredContact'];
  is_primary: boolean;
  can_pick_up: boolean;
  is_emergency_contact: boolean;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface WishlistItemResponse {
  id: string;
  wishlist_id: string;
  category: string | null;
  item_type: CampaignWishlistItem['itemType'];
  description: string;
  size: string | null;
  qty_requested: number;
  priority: string;
  est_cost_cents: number | null;
  allow_substitute: boolean;
  do_not_substitute_reason: string | null;
  recipient_note: string | null;
  status: string;
  qty_fulfilled: number;
  notes: string | null;
  gift_workflow: {
    sponsorship_status: CampaignWishlistItem['giftWorkflow']['sponsorshipStatus'];
    sponsorship_id: string | null;
    qty_committed: number;
    qty_fulfilled: number;
    remaining_qty: number;
    is_fully_fulfilled: boolean;
    is_picked_up: boolean;
    picked_up_at: string | null;
    picked_up_by_contact_id: string | null;
    label_code: string;
    label_version: number;
    label_last_printed_at: string | null;
    label_print_count: number;
  };
  created_at: string | null;
  updated_at: string | null;
}

interface WishlistResponse {
  id: string;
  campaign_id: string;
  recipient_id: string;
  wishlist_status: CampaignWishlist['wishlistStatus'];
  intake_method: CampaignWishlist['intakeMethod'];
  submitted_at: string | null;
  intake_completed_by_contact_id: string | null;
  intake_completed_by_contact: GroupContactResponse | null;
  notes: string | null;
  items: WishlistItemResponse[];
  created_at: string | null;
  updated_at: string | null;
}

interface WorkflowSummaryResponse {
  item_count: number;
  sponsored_item_count: number;
  fulfilled_item_count: number;
  ready_for_pickup_item_count: number;
  picked_up_item_count: number;
  open_item_count: number;
  coverage_rule: CampaignRecipient['workflowSummary']['coverageRule'];
  coverage_required_count: number;
  coverage_sponsored_count: number;
  coverage_remaining_count: number;
  coverage_met: boolean;
}

interface RecipientResponse {
  id: string;
  campaign_id: string;
  recipient_group_id: string;
  recipient_kind: CampaignRecipient['recipientKind'];
  program_type: CampaignRecipient['programType'];
  privacy_level: CampaignRecipient['privacyLevel'];
  display_label: string;
  program_recipient_number: number | null;
  program_recipient_id: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_year: number | null;
  age: number | null;
  age_unit: CampaignRecipient['ageUnit'];
  gender: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  direct_email: string | null;
  direct_phone: string | null;
  facility_room: string | null;
  subgroup_label: string | null;
  mobility_notes: string | null;
  notes: string | null;
  status: CampaignRecipient['status'];
  group: {
    id: string;
    group_name: string;
    group_type: CampaignPeopleGroup['groupType'];
    organization_type: CampaignPeopleGroup['organizationType'];
    status: CampaignPeopleGroup['status'];
  } | null;
  wishlist: WishlistResponse | null;
  workflow_summary: WorkflowSummaryResponse;
  created_at: string | null;
  updated_at: string | null;
}

interface GroupResponse {
  id: string;
  campaign_id: string;
  parent_organization_group_id?: string | null;
  parent_organization?: {
    id: string;
    group_name: string;
    organization_type: CampaignPeopleGroup['organizationType'];
    status: CampaignPeopleGroup['status'];
  } | null;
  family_count?: number;
  group_type: CampaignPeopleGroup['groupType'];
  group_name: string;
  organization_type: CampaignPeopleGroup['organizationType'];
  program_abbreviation: string | null;
  intake_source: string | null;
  external_reference: string | null;
  notes: string | null;
  status: CampaignPeopleGroup['status'];
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  primary_contact: GroupContactResponse | null;
  contacts: GroupContactResponse[];
  authorized_pickup_contacts: GroupContactResponse[];
  recipient_count: number;
  workflow_summary: WorkflowSummaryResponse;
  recipients: RecipientResponse[];
  created_at: string | null;
  updated_at: string | null;
}

interface PeopleWorkspaceResponse {
  campaign_id: string;
  counts: {
    group_count: number;
    active_group_count: number;
    household_count: number;
    organization_count: number;
    recipient_count: number;
    child_count: number;
    adult_count: number;
    wishlist_count: number;
    open_item_count: number;
    sponsored_item_count: number;
    fulfilled_item_count: number;
    ready_for_pickup_item_count: number;
    picked_up_item_count: number;
    recipients_covered_count: number;
    recipients_needing_gifts_count: number;
    groups_with_pickup_contacts_count: number;
    groups_missing_primary_contact_count: number;
    adults_with_direct_contact_count: number;
  };
  groups: GroupResponse[];
  recipients: RecipientResponse[];
  organization_types?: OrganizationTypeResponse[];
  filters: {
    group_types: CampaignPeopleWorkspaceData['filters']['groupTypes'];
    group_statuses: CampaignPeopleWorkspaceData['filters']['groupStatuses'];
    program_types: CampaignPeopleWorkspaceData['filters']['programTypes'];
    recipient_kinds: CampaignPeopleWorkspaceData['filters']['recipientKinds'];
    recipient_statuses: CampaignPeopleWorkspaceData['filters']['recipientStatuses'];
  };
}

interface OrganizationTypeResponse {
  id: string;
  code: string;
  label: string;
  recipient_category: OrganizationTypeOption['recipientCategory'];
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

interface AddressSearchResponse {
  suggestions: Array<{
    label: string;
    address_line1: string;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  }>;
}

export async function getCampaignPeopleWorkspace(
  campaignId: string
): Promise<CampaignPeopleWorkspaceData> {
  const response = await apiFetchJson<PeopleWorkspaceResponse>(
    `/api/v1/campaigns/${campaignId}/people-workspace`
  );

  return {
    campaignId: response.campaign_id,
    counts: {
      groupCount: response.counts.group_count,
      activeGroupCount: response.counts.active_group_count,
      householdCount: response.counts.household_count,
      organizationCount: response.counts.organization_count,
      recipientCount: response.counts.recipient_count,
      childCount: response.counts.child_count,
      adultCount: response.counts.adult_count,
      wishlistCount: response.counts.wishlist_count,
      openItemCount: response.counts.open_item_count,
      sponsoredItemCount: response.counts.sponsored_item_count,
      fulfilledItemCount: response.counts.fulfilled_item_count,
      readyForPickupItemCount: response.counts.ready_for_pickup_item_count,
      pickedUpItemCount: response.counts.picked_up_item_count,
      recipientsCoveredCount: response.counts.recipients_covered_count,
      recipientsNeedingGiftsCount: response.counts.recipients_needing_gifts_count,
      groupsWithPickupContactsCount: response.counts.groups_with_pickup_contacts_count,
      groupsMissingPrimaryContactCount: response.counts.groups_missing_primary_contact_count,
      adultsWithDirectContactCount: response.counts.adults_with_direct_contact_count,
    },
    groups: response.groups.map(mapGroup),
    recipients: response.recipients.map(mapRecipient),
    organizationTypes: (response.organization_types ?? []).map(mapOrganizationType),
    filters: {
      groupTypes: response.filters.group_types,
      groupStatuses: response.filters.group_statuses,
      programTypes: response.filters.program_types,
      recipientKinds: response.filters.recipient_kinds,
      recipientStatuses: response.filters.recipient_statuses,
    },
  };
}

function mapOrganizationType(response: OrganizationTypeResponse): OrganizationTypeOption {
  return {
    id: response.id,
    code: response.code,
    label: response.label,
    recipientCategory: response.recipient_category,
    isActive: response.is_active,
    sortOrder: response.sort_order,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

export async function searchRecipientAddresses(
  campaignId: string,
  query: string
): Promise<CampaignAddressSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  const response = await apiFetchJson<AddressSearchResponse>(
    `/api/v1/campaigns/${campaignId}/recipient-address-search?${params.toString()}`
  );

  return response.suggestions.map((suggestion) => ({
    label: suggestion.label,
    addressLine1: suggestion.address_line1,
    city: suggestion.city,
    state: suggestion.state,
    postalCode: suggestion.postal_code,
  }));
}

export async function createRecipientGroup(
  campaignId: string,
  input: RecipientGroupUpsertInput
): Promise<CampaignPeopleGroup> {
  const response = await apiFetchJson<GroupResponse>(
    `/api/v1/campaigns/${campaignId}/recipient-groups`,
    withJson('POST', {
      group_type: input.groupType,
      group_name: input.groupName,
      parent_organization_group_id: input.parentOrganizationGroupId ?? null,
      organization_type: input.organizationType ?? null,
      program_abbreviation: input.programAbbreviation ?? null,
      intake_source: input.intakeSource ?? null,
      external_reference: input.externalReference ?? null,
      notes: input.notes ?? null,
      status: input.status ?? 'ACTIVE',
      address_line1: input.addressLine1 ?? null,
      address_line2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postal_code: input.postalCode ?? null,
    })
  );

  return mapGroup(response);
}

export async function updateRecipientGroup(
  campaignId: string,
  groupId: string,
  input: Partial<RecipientGroupUpsertInput>
): Promise<CampaignPeopleGroup> {
  const payload: Record<string, unknown> = {};
  if ('groupType' in input) payload.group_type = input.groupType;
  if ('groupName' in input) payload.group_name = input.groupName;
  if ('parentOrganizationGroupId' in input) payload.parent_organization_group_id = input.parentOrganizationGroupId ?? null;
  if ('organizationType' in input) payload.organization_type = input.organizationType ?? null;
  if ('programAbbreviation' in input) payload.program_abbreviation = input.programAbbreviation ?? null;
  if ('intakeSource' in input) payload.intake_source = input.intakeSource ?? null;
  if ('externalReference' in input) payload.external_reference = input.externalReference ?? null;
  if ('notes' in input) payload.notes = input.notes ?? null;
  if ('status' in input) payload.status = input.status;
  if ('addressLine1' in input) payload.address_line1 = input.addressLine1 ?? null;
  if ('addressLine2' in input) payload.address_line2 = input.addressLine2 ?? null;
  if ('city' in input) payload.city = input.city ?? null;
  if ('state' in input) payload.state = input.state ?? null;
  if ('postalCode' in input) payload.postal_code = input.postalCode ?? null;

  const response = await apiFetchJson<GroupResponse>(
    `/api/v1/campaigns/${campaignId}/recipient-groups/${groupId}`,
    withJson('PATCH', payload)
  );

  return mapGroup(response);
}

export async function deleteRecipientGroup(
  campaignId: string,
  groupId: string
): Promise<void> {
  await apiFetchJson(
    `/api/v1/campaigns/${campaignId}/recipient-groups/${groupId}`,
    { method: 'DELETE' }
  );
}

export async function createRecipientGroupContact(
  campaignId: string,
  groupId: string,
  input: GroupContactUpsertInput
): Promise<CampaignPeopleGroupContact> {
  const response = await apiFetchJson<GroupContactResponse>(
    `/api/v1/campaigns/${campaignId}/recipient-groups/${groupId}/contacts`,
    withJson('POST', mapContactPayload(input))
  );

  return mapGroupContact(response);
}

export async function updateRecipientGroupContact(
  campaignId: string,
  groupId: string,
  contactId: string,
  input: Partial<GroupContactUpsertInput>
): Promise<CampaignPeopleGroupContact> {
  const response = await apiFetchJson<GroupContactResponse>(
    `/api/v1/campaigns/${campaignId}/recipient-groups/${groupId}/contacts/${contactId}`,
    withJson('PATCH', mapContactPayload(input))
  );

  return mapGroupContact(response);
}

export async function deleteRecipientGroupContact(
  campaignId: string,
  groupId: string,
  contactId: string
): Promise<void> {
  await apiFetchJson(
    `/api/v1/campaigns/${campaignId}/recipient-groups/${groupId}/contacts/${contactId}`,
    { method: 'DELETE' }
  );
}

export async function createCampaignRecipient(
  campaignId: string,
  input: RecipientUpsertInput
): Promise<CampaignRecipient> {
  const response = await apiFetchJson<RecipientResponse>(
    `/api/v1/campaigns/${campaignId}/recipients`,
    withJson('POST', mapRecipientPayload(input))
  );

  return mapRecipient(response);
}

export async function updateCampaignRecipient(
  campaignId: string,
  recipientId: string,
  input: Partial<RecipientUpsertInput>
): Promise<CampaignRecipient> {
  const response = await apiFetchJson<RecipientResponse>(
    `/api/v1/campaigns/${campaignId}/recipients/${recipientId}`,
    withJson('PATCH', mapRecipientPayload(input))
  );

  return mapRecipient(response);
}

export async function deleteCampaignRecipient(
  campaignId: string,
  recipientId: string
): Promise<void> {
  await apiFetchJson(
    `/api/v1/campaigns/${campaignId}/recipients/${recipientId}`,
    { method: 'DELETE' }
  );
}

export async function upsertCampaignWishlist(
  campaignId: string,
  recipientId: string,
  input: WishlistUpsertInput
): Promise<CampaignWishlist> {
  const response = await apiFetchJson<WishlistResponse>(
    `/api/v1/campaigns/${campaignId}/recipients/${recipientId}/wishlist`,
    withJson('PUT', {
      wishlist_status: input.wishlistStatus,
      intake_method: input.intakeMethod ?? null,
      submitted_at: input.submittedAt ?? null,
      intake_completed_by_contact_id: input.intakeCompletedByContactId ?? null,
      notes: input.notes ?? null,
    })
  );

  return mapWishlist(response);
}

export async function createCampaignWishlistItem(
  campaignId: string,
  recipientId: string,
  input: WishlistItemUpsertInput
): Promise<CampaignWishlistItem> {
  const response = await apiFetchJson<WishlistItemResponse>(
    `/api/v1/campaigns/${campaignId}/recipients/${recipientId}/wishlist/items`,
    withJson('POST', mapWishlistItemPayload(input))
  );

  return mapWishlistItem(response);
}

export async function updateCampaignWishlistItem(
  campaignId: string,
  recipientId: string,
  itemId: string,
  input: Partial<WishlistItemUpsertInput>
): Promise<CampaignWishlistItem> {
  const response = await apiFetchJson<WishlistItemResponse>(
    `/api/v1/campaigns/${campaignId}/recipients/${recipientId}/wishlist/items/${itemId}`,
    withJson('PATCH', mapWishlistItemPayload(input))
  );

  return mapWishlistItem(response);
}

export async function deleteCampaignWishlistItem(
  campaignId: string,
  recipientId: string,
  itemId: string
): Promise<void> {
  await apiFetchJson(
    `/api/v1/campaigns/${campaignId}/recipients/${recipientId}/wishlist/items/${itemId}`,
    { method: 'DELETE' }
  );
}

function mapGroup(response: GroupResponse): CampaignPeopleGroup {
  return {
    id: response.id,
    campaignId: response.campaign_id,
    parentOrganizationGroupId: response.parent_organization_group_id ?? null,
    parentOrganization: response.parent_organization
      ? {
          id: response.parent_organization.id,
          groupName: response.parent_organization.group_name,
          organizationType: response.parent_organization.organization_type,
          status: response.parent_organization.status,
        }
      : null,
    familyCount: response.family_count ?? 0,
    groupType: response.group_type,
    groupName: response.group_name,
    organizationType: response.organization_type,
    programAbbreviation: response.program_abbreviation,
    intakeSource: response.intake_source,
    externalReference: response.external_reference,
    notes: response.notes,
    status: response.status,
    addressLine1: response.address_line1,
    addressLine2: response.address_line2,
    city: response.city,
    state: response.state,
    postalCode: response.postal_code,
    primaryContact: response.primary_contact ? mapGroupContact(response.primary_contact) : null,
    contacts: response.contacts.map(mapGroupContact),
    authorizedPickupContacts: response.authorized_pickup_contacts.map(mapGroupContact),
    recipientCount: response.recipient_count,
    workflowSummary: mapWorkflowSummary(response.workflow_summary),
    recipients: response.recipients.map(mapRecipient),
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapRecipient(response: RecipientResponse): CampaignRecipient {
  return {
    id: response.id,
    campaignId: response.campaign_id,
    recipientGroupId: response.recipient_group_id,
    recipientKind: response.recipient_kind,
    programType: response.program_type,
    privacyLevel: response.privacy_level,
    displayLabel: response.display_label,
    programRecipientNumber: response.program_recipient_number,
    programRecipientId: response.program_recipient_id,
    firstName: response.first_name,
    lastName: response.last_name,
    birthYear: response.birth_year,
    age: response.age,
    ageUnit: response.age_unit,
    gender: response.gender,
    addressLine1: response.address_line1,
    addressLine2: response.address_line2,
    city: response.city,
    state: response.state,
    postalCode: response.postal_code,
    directEmail: response.direct_email,
    directPhone: response.direct_phone,
    facilityRoom: response.facility_room,
    subgroupLabel: response.subgroup_label,
    mobilityNotes: response.mobility_notes,
    notes: response.notes,
    status: response.status,
    group: response.group
      ? {
          id: response.group.id,
          groupName: response.group.group_name,
          groupType: response.group.group_type,
          organizationType: response.group.organization_type,
          status: response.group.status,
        }
      : null,
    wishlist: response.wishlist ? mapWishlist(response.wishlist) : null,
    workflowSummary: mapWorkflowSummary(response.workflow_summary),
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapWorkflowSummary(response: WorkflowSummaryResponse): CampaignRecipient['workflowSummary'] {
  return {
    itemCount: response.item_count,
    sponsoredItemCount: response.sponsored_item_count,
    fulfilledItemCount: response.fulfilled_item_count,
    readyForPickupItemCount: response.ready_for_pickup_item_count,
    pickedUpItemCount: response.picked_up_item_count,
    openItemCount: response.open_item_count,
    coverageRule: response.coverage_rule,
    coverageRequiredCount: response.coverage_required_count,
    coverageSponsoredCount: response.coverage_sponsored_count,
    coverageRemainingCount: response.coverage_remaining_count,
    coverageMet: response.coverage_met,
  };
}

function mapWishlist(response: WishlistResponse): CampaignWishlist {
  return {
    id: response.id,
    campaignId: response.campaign_id,
    recipientId: response.recipient_id,
    wishlistStatus: response.wishlist_status,
    intakeMethod: response.intake_method,
    submittedAt: response.submitted_at,
    intakeCompletedByContactId: response.intake_completed_by_contact_id,
    intakeCompletedByContact: response.intake_completed_by_contact
      ? mapGroupContact(response.intake_completed_by_contact)
      : null,
    notes: response.notes,
    items: response.items.map(mapWishlistItem),
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapWishlistItem(response: WishlistItemResponse): CampaignWishlistItem {
  return {
    id: response.id,
    wishlistId: response.wishlist_id,
    category: response.category,
    itemType: response.item_type,
    description: response.description,
    size: response.size,
    qtyRequested: response.qty_requested,
    priority: response.priority,
    estCostCents: response.est_cost_cents,
    allowSubstitute: response.allow_substitute,
    doNotSubstituteReason: response.do_not_substitute_reason,
    recipientNote: response.recipient_note,
    status: response.status,
    qtyFulfilled: response.qty_fulfilled,
    notes: response.notes,
    giftWorkflow: {
      sponsorshipStatus: response.gift_workflow.sponsorship_status,
      sponsorshipId: response.gift_workflow.sponsorship_id,
      qtyCommitted: response.gift_workflow.qty_committed,
      qtyFulfilled: response.gift_workflow.qty_fulfilled,
      remainingQty: response.gift_workflow.remaining_qty,
      isFullyFulfilled: response.gift_workflow.is_fully_fulfilled,
      isPickedUp: response.gift_workflow.is_picked_up,
      pickedUpAt: response.gift_workflow.picked_up_at,
      pickedUpByContactId: response.gift_workflow.picked_up_by_contact_id,
      labelCode: response.gift_workflow.label_code,
      labelVersion: response.gift_workflow.label_version,
      labelLastPrintedAt: response.gift_workflow.label_last_printed_at,
      labelPrintCount: response.gift_workflow.label_print_count,
    },
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapGroupContact(response: GroupContactResponse): CampaignPeopleGroupContact {
  return {
    id: response.id,
    recipientGroupId: response.recipient_group_id,
    displayName: response.display_name,
    contactRole: response.contact_role,
    relationshipLabel: response.relationship_label,
    firstName: response.first_name,
    lastName: response.last_name,
    email: response.email,
    phone: response.phone,
    preferredContact: response.preferred_contact,
    isPrimary: response.is_primary,
    canPickUp: response.can_pick_up,
    isEmergencyContact: response.is_emergency_contact,
    notes: response.notes,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapContactPayload(input: Partial<GroupContactUpsertInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ('contactRole' in input) payload.contact_role = input.contactRole;
  if ('relationshipLabel' in input) payload.relationship_label = input.relationshipLabel ?? null;
  if ('firstName' in input) payload.first_name = input.firstName ?? null;
  if ('lastName' in input) payload.last_name = input.lastName ?? null;
  if ('email' in input) payload.email = input.email ?? null;
  if ('phone' in input) payload.phone = input.phone ?? null;
  if ('preferredContact' in input) payload.preferred_contact = input.preferredContact ?? 'NONE';
  if ('isPrimary' in input) payload.is_primary = input.isPrimary ?? false;
  if ('canPickUp' in input) payload.can_pick_up = input.canPickUp ?? false;
  if ('isEmergencyContact' in input) payload.is_emergency_contact = input.isEmergencyContact ?? false;
  if ('notes' in input) payload.notes = input.notes ?? null;
  return payload;
}

function mapRecipientPayload(input: Partial<RecipientUpsertInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ('recipientGroupId' in input) payload.recipient_group_id = input.recipientGroupId;
  if ('recipientKind' in input) payload.recipient_kind = input.recipientKind;
  if ('programType' in input) payload.program_type = input.programType;
  if ('privacyLevel' in input) payload.privacy_level = input.privacyLevel;
  if ('displayLabel' in input) payload.display_label = input.displayLabel;
  if ('firstName' in input) payload.first_name = input.firstName ?? null;
  if ('lastName' in input) payload.last_name = input.lastName ?? null;
  if ('birthYear' in input) payload.birth_year = input.birthYear ?? null;
  if ('age' in input) payload.age = input.age ?? null;
  if ('ageUnit' in input) payload.age_unit = input.ageUnit ?? null;
  if ('gender' in input) payload.gender = input.gender ?? null;
  if ('addressLine1' in input) payload.address_line1 = input.addressLine1 ?? null;
  if ('addressLine2' in input) payload.address_line2 = input.addressLine2 ?? null;
  if ('city' in input) payload.city = input.city ?? null;
  if ('state' in input) payload.state = input.state ?? null;
  if ('postalCode' in input) payload.postal_code = input.postalCode ?? null;
  if ('directEmail' in input) payload.direct_email = input.directEmail ?? null;
  if ('directPhone' in input) payload.direct_phone = input.directPhone ?? null;
  if ('facilityRoom' in input) payload.facility_room = input.facilityRoom ?? null;
  if ('subgroupLabel' in input) payload.subgroup_label = input.subgroupLabel ?? null;
  if ('mobilityNotes' in input) payload.mobility_notes = input.mobilityNotes ?? null;
  if ('notes' in input) payload.notes = input.notes ?? null;
  if ('status' in input) payload.status = input.status;
  return payload;
}

function mapWishlistItemPayload(input: Partial<WishlistItemUpsertInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ('category' in input) payload.category = input.category ?? null;
  if ('itemType' in input) payload.item_type = input.itemType;
  if ('description' in input) payload.description = input.description;
  if ('size' in input) payload.size = input.size ?? null;
  if ('qtyRequested' in input) payload.qty_requested = input.qtyRequested ?? null;
  if ('priority' in input) payload.priority = input.priority;
  if ('estCostCents' in input) payload.est_cost_cents = input.estCostCents ?? null;
  if ('allowSubstitute' in input) payload.allow_substitute = input.allowSubstitute ?? true;
  if ('doNotSubstituteReason' in input) payload.do_not_substitute_reason = input.doNotSubstituteReason ?? null;
  if ('recipientNote' in input) payload.recipient_note = input.recipientNote ?? null;
  if ('notes' in input) payload.notes = input.notes ?? null;
  return payload;
}

function withJson(method: 'POST' | 'PATCH' | 'PUT', body: Record<string, unknown>) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
