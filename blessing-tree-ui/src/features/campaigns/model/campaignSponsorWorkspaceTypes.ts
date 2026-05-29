export type SponsorPreferredContact = 'EMAIL' | 'PHONE' | 'TEXT' | 'NONE';
export type SponsorSource = 'STAFF_ENTRY' | 'PUBLIC_QR' | 'PUBLIC_LINK' | 'IMPORT' | 'OTHER';
export type SponsorshipStatus = 'ACTIVE' | 'COMPLETE' | 'CANCELLED';
export type SponsorshipInterestStatus = 'NEW' | 'CONTACTED' | 'RESPONDED' | 'COMMITTED' | 'DECLINED';
export type SponsorshipDropOffStatus = 'NOT_STARTED' | 'SCHEDULED' | 'RECEIVED' | 'LATE';
export type SponsorInteractionChannel = 'CALL' | 'EMAIL' | 'TEXT' | 'IN_PERSON';
export type SponsorInteractionDirection = 'OUTBOUND' | 'INBOUND';
export type SponsorInteractionOrigin = 'MANUAL' | 'CAMPAIGN_COMMUNICATION' | 'PUBLIC_SIGNUP' | 'SYSTEM';
export type SponsorInteractionOutcome =
  | 'LEFT_VM'
  | 'NO_ANSWER'
  | 'REACHED'
  | 'BOUNCED'
  | 'WRONG_NUMBER'
  | 'PROMISED_DATE'
  | 'COMPLETED'
  | 'OTHER';
export type PendingSponsorRegistrationStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'CANCELLED';

export interface CampaignSponsoredGift {
  id: string;
  sponsorshipId: string;
  wishlistItemId: string;
  qtyCommitted: number;
  committedAt: string | null;
  notes: string | null;
  recipient: {
    id: string;
    displayLabel: string;
    programRecipientId: string | null;
  } | null;
  gift: {
    description: string;
    category: string | null;
    itemType: string | null;
    size: string | null;
    qtyRequested: number | null;
    status: string | null;
  } | null;
}

export interface CampaignSponsorInteraction {
  id: string;
  campaignId: string;
  sponsorId: string;
  channel: SponsorInteractionChannel;
  direction: SponsorInteractionDirection;
  subject: string | null;
  originType: SponsorInteractionOrigin;
  outcome: SponsorInteractionOutcome;
  notes: string | null;
  occurredAt: string | null;
  createdByUserId: string | null;
  followUpAt: string | null;
  relatedSponsorshipId: string | null;
  relatedScheduleId: string | null;
  relatedDeliveryAttemptId: string | null;
  externalMessageId: string | null;
}

export interface SponsorCommunicationWarning {
  code: string;
  message: string;
}

export interface SponsorCommunicationPreview {
  templateId: string;
  sponsorId: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  mergeFields: Record<string, string>;
  warnings: SponsorCommunicationWarning[];
}

export interface SponsorCommunicationSendResult {
  sendId: string;
  templateId: string;
  sponsorId: string;
  recipientEmail: string;
  subject: string;
  status: string;
  warnings: SponsorCommunicationWarning[];
}

export interface CampaignSponsorParticipation {
  status: SponsorshipStatus;
  interestStatus: SponsorshipInterestStatus;
  dropOffStatus: SponsorshipDropOffStatus;
  dropOffDueAt: string | null;
  dropOffCompletedAt: string | null;
  selfRegistered: boolean;
  sponsorCode: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignSponsor {
  id: string;
  campaignId: string;
  sponsorshipId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  preferredContact: SponsorPreferredContact;
  source: SponsorSource;
  sourceDetail: string | null;
  notes: string | null;
  isActive: boolean;
  selfRegisteredAt: string | null;
  lastContactedAt: string | null;
  doNotContact: boolean;
  participation: CampaignSponsorParticipation;
  sponsoredItemCount: number;
  interactionCount: number;
  openFollowUpCount: number;
  recentInteractions: CampaignSponsorInteraction[];
  sponsoredItems: CampaignSponsoredGift[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PendingSponsorRegistration {
  id: string;
  campaignId: string;
  matchedSponsorId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  organizationName: string | null;
  phone: string | null;
  preferredContact: SponsorPreferredContact;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  source: SponsorSource;
  selectedWishlistItemIds: string[];
  notes: string | null;
  verificationSentAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  status: PendingSponsorRegistrationStatus;
  submittedIp: string | null;
  userAgent: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignSponsorWorkspaceData {
  campaignId: string;
  counts: {
    sponsorCount: number;
    activeSponsorshipCount: number;
    sponsoredItemCount: number;
    openSponsorNeedCount: number;
    contactableSponsorCount: number;
    pendingRegistrationCount: number;
    selfRegisteredCount: number;
  };
  sponsors: CampaignSponsor[];
  filters: {
    statuses: SponsorshipStatus[];
    interestStatuses: SponsorshipInterestStatus[];
    dropOffStatuses: SponsorshipDropOffStatus[];
    preferredContacts: SponsorPreferredContact[];
  };
}

export interface SponsorUpsertInput {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  preferredContact: SponsorPreferredContact;
  source: SponsorSource;
  sourceDetail: string | null;
  notes: string | null;
  isActive: boolean;
  doNotContact: boolean;
}

export interface SponsorshipUpsertInput {
  status: SponsorshipStatus;
  interestStatus: SponsorshipInterestStatus;
  dropOffStatus: SponsorshipDropOffStatus;
  dropOffDueAt: string | null;
  dropOffCompletedAt: string | null;
  selfRegistered: boolean;
  sponsorCode: string | null;
  notes: string | null;
}

export interface SponsorInteractionUpsertInput {
  channel: SponsorInteractionChannel;
  direction: SponsorInteractionDirection;
  subject: string | null;
  outcome: SponsorInteractionOutcome;
  notes: string | null;
  occurredAt: string | null;
  followUpAt: string | null;
}
