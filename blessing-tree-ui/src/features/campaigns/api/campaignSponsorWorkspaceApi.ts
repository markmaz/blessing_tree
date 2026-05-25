import { apiFetchJson } from '@/shared/api/client';
import type {
  CampaignSponsor,
  CampaignSponsorInteraction,
  CampaignSponsorWorkspaceData,
  PendingSponsorRegistration,
  SponsorInteractionUpsertInput,
  SponsorUpsertInput,
  SponsorshipUpsertInput,
} from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';

interface SponsoredItemResponse {
  id: string;
  sponsorship_id: string;
  wishlist_item_id: string;
  qty_committed: number;
  committed_at: string | null;
  notes: string | null;
  recipient: {
    id: string;
    display_label: string;
    program_recipient_id: string | null;
  } | null;
  gift: {
    description: string;
    category: string | null;
    item_type: string | null;
    size: string | null;
    qty_requested: number | null;
    status: string | null;
  } | null;
}

interface SponsorInteractionResponse {
  id: string;
  campaign_id: string;
  sponsor_id: string;
  channel: CampaignSponsorInteraction['channel'];
  direction: CampaignSponsorInteraction['direction'];
  subject: string | null;
  origin_type: CampaignSponsorInteraction['originType'];
  outcome: CampaignSponsorInteraction['outcome'];
  notes: string | null;
  occurred_at: string | null;
  created_by_user_id: string | null;
  follow_up_at: string | null;
  related_sponsorship_id: string | null;
  related_schedule_id: string | null;
  related_delivery_attempt_id: string | null;
  external_message_id: string | null;
}

interface SponsorResponse {
  id: string;
  campaign_id: string;
  sponsorship_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  preferred_contact: CampaignSponsor['preferredContact'];
  source: CampaignSponsor['source'];
  source_detail: string | null;
  notes: string | null;
  is_active: boolean;
  self_registered_at: string | null;
  last_contacted_at: string | null;
  do_not_contact: boolean;
  participation: {
    status: CampaignSponsor['participation']['status'];
    interest_status: CampaignSponsor['participation']['interestStatus'];
    drop_off_status: CampaignSponsor['participation']['dropOffStatus'];
    drop_off_due_at: string | null;
    drop_off_completed_at: string | null;
    self_registered: boolean;
    sponsor_code: string | null;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  sponsored_item_count: number;
  interaction_count: number;
  open_follow_up_count: number;
  recent_interactions: SponsorInteractionResponse[];
  sponsored_items: SponsoredItemResponse[];
  created_at: string | null;
  updated_at: string | null;
}

interface SponsorWorkspaceResponse {
  campaign_id: string;
  counts: {
    sponsor_count: number;
    active_sponsorship_count: number;
    sponsored_item_count: number;
    open_sponsor_need_count: number;
    contactable_sponsor_count: number;
    pending_registration_count: number;
    self_registered_count: number;
  };
  sponsors: SponsorResponse[];
  filters: {
    statuses: CampaignSponsorWorkspaceData['filters']['statuses'];
    interest_statuses: CampaignSponsorWorkspaceData['filters']['interestStatuses'];
    drop_off_statuses: CampaignSponsorWorkspaceData['filters']['dropOffStatuses'];
    preferred_contacts: CampaignSponsorWorkspaceData['filters']['preferredContacts'];
  };
}

interface PendingRegistrationResponse {
  id: string;
  campaign_id: string;
  matched_sponsor_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  organization_name: string | null;
  phone: string | null;
  preferred_contact: PendingSponsorRegistration['preferredContact'];
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  source: PendingSponsorRegistration['source'];
  selected_wishlist_item_ids: string[];
  notes: string | null;
  verification_sent_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  status: PendingSponsorRegistration['status'];
  submitted_ip: string | null;
  user_agent: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getCampaignSponsorWorkspace(
  campaignId: string
): Promise<CampaignSponsorWorkspaceData> {
  const response = await apiFetchJson<SponsorWorkspaceResponse>(
    `/api/v1/campaigns/${campaignId}/sponsor-workspace`
  );

  return {
    campaignId: response.campaign_id,
    counts: {
      sponsorCount: response.counts.sponsor_count,
      activeSponsorshipCount: response.counts.active_sponsorship_count,
      sponsoredItemCount: response.counts.sponsored_item_count,
      openSponsorNeedCount: response.counts.open_sponsor_need_count,
      contactableSponsorCount: response.counts.contactable_sponsor_count,
      pendingRegistrationCount: response.counts.pending_registration_count,
      selfRegisteredCount: response.counts.self_registered_count,
    },
    sponsors: response.sponsors.map(mapSponsor),
    filters: {
      statuses: response.filters.statuses,
      interestStatuses: response.filters.interest_statuses,
      dropOffStatuses: response.filters.drop_off_statuses,
      preferredContacts: response.filters.preferred_contacts,
    },
  };
}

export async function createCampaignSponsor(
  campaignId: string,
  sponsor: SponsorUpsertInput,
  participation: SponsorshipUpsertInput
): Promise<CampaignSponsor> {
  const response = await apiFetchJson<SponsorResponse>(
    `/api/v1/campaigns/${campaignId}/sponsors`,
    withJson('POST', {
      sponsor: mapSponsorPayload(sponsor),
      participation: mapParticipationPayload(participation),
    })
  );
  return mapSponsor(response);
}

export async function updateCampaignSponsor(
  campaignId: string,
  sponsorId: string,
  sponsor: Partial<SponsorUpsertInput>,
  participation: Partial<SponsorshipUpsertInput>
): Promise<CampaignSponsor> {
  const response = await apiFetchJson<SponsorResponse>(
    `/api/v1/campaigns/${campaignId}/sponsors/${sponsorId}`,
    withJson('PATCH', {
      sponsor: mapSponsorPayload(sponsor),
      participation: mapParticipationPayload(participation),
    })
  );
  return mapSponsor(response);
}

export async function deleteCampaignSponsor(campaignId: string, sponsorId: string): Promise<void> {
  await apiFetchJson(`/api/v1/campaigns/${campaignId}/sponsors/${sponsorId}`, {
    method: 'DELETE',
  });
}

export async function getCampaignSponsorInteractions(
  campaignId: string,
  sponsorId: string
): Promise<CampaignSponsorInteraction[]> {
  const response = await apiFetchJson<SponsorInteractionResponse[]>(
    `/api/v1/campaigns/${campaignId}/sponsors/${sponsorId}/interactions`
  );
  return response.map(mapInteraction);
}

export async function createCampaignSponsorInteraction(
  campaignId: string,
  sponsorId: string,
  input: SponsorInteractionUpsertInput
): Promise<CampaignSponsorInteraction> {
  const response = await apiFetchJson<SponsorInteractionResponse>(
    `/api/v1/campaigns/${campaignId}/sponsors/${sponsorId}/interactions`,
    withJson('POST', mapInteractionPayload(input))
  );
  return mapInteraction(response);
}

export async function updateCampaignSponsorInteraction(
  campaignId: string,
  sponsorId: string,
  interactionId: string,
  input: Partial<SponsorInteractionUpsertInput>
): Promise<CampaignSponsorInteraction> {
  const response = await apiFetchJson<SponsorInteractionResponse>(
    `/api/v1/campaigns/${campaignId}/sponsors/${sponsorId}/interactions/${interactionId}`,
    withJson('PATCH', mapInteractionPayload(input))
  );
  return mapInteraction(response);
}

export async function deleteCampaignSponsorInteraction(
  campaignId: string,
  sponsorId: string,
  interactionId: string
): Promise<void> {
  await apiFetchJson(`/api/v1/campaigns/${campaignId}/sponsors/${sponsorId}/interactions/${interactionId}`, {
    method: 'DELETE',
  });
}

export async function getPendingSponsorRegistrations(
  campaignId: string
): Promise<PendingSponsorRegistration[]> {
  const response = await apiFetchJson<PendingRegistrationResponse[]>(
    `/api/v1/campaigns/${campaignId}/pending-sponsor-registrations`
  );
  return response.map(mapPendingRegistration);
}

export async function resendPendingSponsorRegistration(
  campaignId: string,
  registrationId: string
): Promise<PendingSponsorRegistration> {
  const response = await apiFetchJson<{ registration: PendingRegistrationResponse }>(
    `/api/v1/campaigns/${campaignId}/pending-sponsor-registrations/${registrationId}/resend`,
    { method: 'POST' }
  );
  return mapPendingRegistration(response.registration);
}

export async function cancelPendingSponsorRegistration(
  campaignId: string,
  registrationId: string
): Promise<PendingSponsorRegistration> {
  const response = await apiFetchJson<{ registration: PendingRegistrationResponse }>(
    `/api/v1/campaigns/${campaignId}/pending-sponsor-registrations/${registrationId}/cancel`,
    { method: 'POST' }
  );
  return mapPendingRegistration(response.registration);
}

export async function verifyPendingSponsorRegistration(
  campaignId: string,
  registrationId: string
): Promise<void> {
  await apiFetchJson(
    `/api/v1/campaigns/${campaignId}/pending-sponsor-registrations/${registrationId}/verify`,
    { method: 'POST' }
  );
}

function mapPendingRegistration(item: PendingRegistrationResponse): PendingSponsorRegistration {
  return {
    id: item.id,
    campaignId: item.campaign_id,
    matchedSponsorId: item.matched_sponsor_id,
    email: item.email,
    firstName: item.first_name,
    lastName: item.last_name,
    displayName: item.display_name,
    organizationName: item.organization_name,
    phone: item.phone,
    preferredContact: item.preferred_contact,
    addressLine1: item.address_line1,
    addressLine2: item.address_line2,
    city: item.city,
    state: item.state,
    postalCode: item.postal_code,
    source: item.source,
    selectedWishlistItemIds: item.selected_wishlist_item_ids,
    notes: item.notes,
    verificationSentAt: item.verification_sent_at,
    verifiedAt: item.verified_at,
    expiresAt: item.expires_at,
    status: item.status,
    submittedIp: item.submitted_ip,
    userAgent: item.user_agent,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function mapSponsor(response: SponsorResponse): CampaignSponsor {
  return {
    id: response.id,
    campaignId: response.campaign_id,
    sponsorshipId: response.sponsorship_id,
    displayName: response.display_name,
    firstName: response.first_name,
    lastName: response.last_name,
    organizationName: response.organization_name,
    email: response.email,
    phone: response.phone,
    addressLine1: response.address_line1,
    addressLine2: response.address_line2,
    city: response.city,
    state: response.state,
    postalCode: response.postal_code,
    preferredContact: response.preferred_contact,
    source: response.source,
    sourceDetail: response.source_detail,
    notes: response.notes,
    isActive: response.is_active,
    selfRegisteredAt: response.self_registered_at,
    lastContactedAt: response.last_contacted_at,
    doNotContact: response.do_not_contact,
    participation: {
      status: response.participation.status,
      interestStatus: response.participation.interest_status,
      dropOffStatus: response.participation.drop_off_status,
      dropOffDueAt: response.participation.drop_off_due_at,
      dropOffCompletedAt: response.participation.drop_off_completed_at,
      selfRegistered: response.participation.self_registered,
      sponsorCode: response.participation.sponsor_code,
      notes: response.participation.notes,
      createdAt: response.participation.created_at,
      updatedAt: response.participation.updated_at,
    },
    sponsoredItemCount: response.sponsored_item_count,
    interactionCount: response.interaction_count,
    openFollowUpCount: response.open_follow_up_count,
    recentInteractions: response.recent_interactions.map(mapInteraction),
    sponsoredItems: response.sponsored_items.map((item) => ({
      id: item.id,
      sponsorshipId: item.sponsorship_id,
      wishlistItemId: item.wishlist_item_id,
      qtyCommitted: item.qty_committed,
      committedAt: item.committed_at,
      notes: item.notes,
      recipient: item.recipient
        ? {
            id: item.recipient.id,
            displayLabel: item.recipient.display_label,
            programRecipientId: item.recipient.program_recipient_id,
          }
        : null,
      gift: item.gift
        ? {
            description: item.gift.description,
            category: item.gift.category,
            itemType: item.gift.item_type,
            size: item.gift.size,
            qtyRequested: item.gift.qty_requested,
            status: item.gift.status,
          }
        : null,
    })),
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapInteraction(response: SponsorInteractionResponse): CampaignSponsorInteraction {
  return {
    id: response.id,
    campaignId: response.campaign_id,
    sponsorId: response.sponsor_id,
    channel: response.channel,
    direction: response.direction,
    subject: response.subject,
    originType: response.origin_type,
    outcome: response.outcome,
    notes: response.notes,
    occurredAt: response.occurred_at,
    createdByUserId: response.created_by_user_id,
    followUpAt: response.follow_up_at,
    relatedSponsorshipId: response.related_sponsorship_id,
    relatedScheduleId: response.related_schedule_id,
    relatedDeliveryAttemptId: response.related_delivery_attempt_id,
    externalMessageId: response.external_message_id,
  };
}

function mapSponsorPayload(input: Partial<SponsorUpsertInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ('firstName' in input) payload.first_name = input.firstName ?? null;
  if ('lastName' in input) payload.last_name = input.lastName ?? null;
  if ('displayName' in input) payload.display_name = input.displayName ?? null;
  if ('organizationName' in input) payload.organization_name = input.organizationName ?? null;
  if ('email' in input) payload.email = input.email ?? null;
  if ('phone' in input) payload.phone = input.phone ?? null;
  if ('addressLine1' in input) payload.address_line1 = input.addressLine1 ?? null;
  if ('addressLine2' in input) payload.address_line2 = input.addressLine2 ?? null;
  if ('city' in input) payload.city = input.city ?? null;
  if ('state' in input) payload.state = input.state ?? null;
  if ('postalCode' in input) payload.postal_code = input.postalCode ?? null;
  if ('preferredContact' in input) payload.preferred_contact = input.preferredContact ?? 'NONE';
  if ('source' in input) payload.source = input.source ?? 'STAFF_ENTRY';
  if ('sourceDetail' in input) payload.source_detail = input.sourceDetail ?? null;
  if ('notes' in input) payload.notes = input.notes ?? null;
  if ('isActive' in input) payload.is_active = input.isActive ?? true;
  if ('doNotContact' in input) payload.do_not_contact = input.doNotContact ?? false;
  return payload;
}

function mapParticipationPayload(input: Partial<SponsorshipUpsertInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ('status' in input) payload.status = input.status;
  if ('interestStatus' in input) payload.interest_status = input.interestStatus;
  if ('dropOffStatus' in input) payload.drop_off_status = input.dropOffStatus;
  if ('dropOffDueAt' in input) payload.drop_off_due_at = input.dropOffDueAt ?? null;
  if ('dropOffCompletedAt' in input) payload.drop_off_completed_at = input.dropOffCompletedAt ?? null;
  if ('selfRegistered' in input) payload.self_registered = input.selfRegistered ?? false;
  if ('sponsorCode' in input) payload.sponsor_code = input.sponsorCode ?? null;
  if ('notes' in input) payload.participation_notes = input.notes ?? null;
  return payload;
}

function mapInteractionPayload(input: Partial<SponsorInteractionUpsertInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ('channel' in input) payload.channel = input.channel;
  if ('direction' in input) payload.direction = input.direction;
  if ('subject' in input) payload.subject = input.subject ?? null;
  if ('outcome' in input) payload.outcome = input.outcome;
  if ('notes' in input) payload.notes = input.notes ?? null;
  if ('occurredAt' in input) payload.occurred_at = input.occurredAt ?? null;
  if ('followUpAt' in input) payload.follow_up_at = input.followUpAt ?? null;
  return payload;
}

function withJson(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
