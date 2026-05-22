export type RecipientGroupType = 'HOUSEHOLD' | 'CARE_FACILITY';

export type RecipientGroupStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type GroupContactRole =
  | 'PARENT'
  | 'GUARDIAN'
  | 'SOCIAL_WORKER'
  | 'STAFF'
  | 'COORDINATOR'
  | 'OTHER';

export type PreferredContact = 'EMAIL' | 'PHONE' | 'TEXT' | 'NONE';

export type RecipientKind = 'CHILD' | 'ADULT';

export type RecipientProgramType = 'CHILD_FAMILY' | 'NURSING_HOME';

export type RecipientPrivacyLevel = 'STANDARD' | 'RESTRICTED' | 'CONFIDENTIAL';

export type RecipientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type WishlistStatus = 'DRAFT' | 'READY' | 'LOCKED';

export type WishlistIntakeMethod = 'PHONE' | 'FORM' | 'STAFF_ENTRY' | 'IMPORT';

export type WishlistItemType = 'GIFT' | 'CLOTHING' | 'ESSENTIAL' | 'GIFT_CARD' | 'EXPERIENCE' | 'OTHER';

export interface CampaignPeopleGroupContact {
  id: string;
  recipientGroupId: string;
  contactRole: GroupContactRole;
  relationshipLabel: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  preferredContact: PreferredContact;
  isPrimary: boolean;
  canPickUp: boolean;
  isEmergencyContact: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignWishlistItem {
  id: string;
  wishlistId: string;
  category: string | null;
  itemType: WishlistItemType;
  description: string;
  size: string | null;
  qtyRequested: number;
  priority: string;
  estCostCents: number | null;
  allowSubstitute: boolean;
  doNotSubstituteReason: string | null;
  recipientNote: string | null;
  status: string;
  qtyFulfilled: number;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignWishlist {
  id: string;
  campaignId: string;
  recipientId: string;
  wishlistStatus: WishlistStatus;
  intakeMethod: WishlistIntakeMethod | null;
  submittedAt: string | null;
  intakeCompletedByContactId: string | null;
  intakeCompletedByContact: CampaignPeopleGroupContact | null;
  notes: string | null;
  items: CampaignWishlistItem[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignPeopleGroupSummary {
  id: string;
  groupName: string;
  groupType: RecipientGroupType;
  status: RecipientGroupStatus;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  recipientGroupId: string;
  recipientKind: RecipientKind;
  programType: RecipientProgramType;
  privacyLevel: RecipientPrivacyLevel;
  displayLabel: string;
  firstName: string | null;
  lastName: string | null;
  birthYear: number | null;
  age: number | null;
  gender: string | null;
  directEmail: string | null;
  directPhone: string | null;
  facilityRoom: string | null;
  subgroupLabel: string | null;
  mobilityNotes: string | null;
  notes: string | null;
  status: RecipientStatus;
  group: CampaignPeopleGroupSummary | null;
  wishlist: CampaignWishlist | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignPeopleGroup {
  id: string;
  campaignId: string;
  groupType: RecipientGroupType;
  groupName: string;
  intakeSource: string | null;
  externalReference: string | null;
  notes: string | null;
  status: RecipientGroupStatus;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  primaryContact: CampaignPeopleGroupContact | null;
  contacts: CampaignPeopleGroupContact[];
  recipientCount: number;
  recipients: CampaignRecipient[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignPeopleWorkspaceCounts {
  groupCount: number;
  activeGroupCount: number;
  householdCount: number;
  careFacilityCount: number;
  recipientCount: number;
  childCount: number;
  adultCount: number;
  wishlistCount: number;
  openItemCount: number;
}

export interface CampaignPeopleWorkspaceFilters {
  groupTypes: RecipientGroupType[];
  groupStatuses: RecipientGroupStatus[];
  programTypes: RecipientProgramType[];
  recipientKinds: RecipientKind[];
  recipientStatuses: RecipientStatus[];
}

export interface CampaignPeopleWorkspaceData {
  campaignId: string;
  counts: CampaignPeopleWorkspaceCounts;
  groups: CampaignPeopleGroup[];
  recipients: CampaignRecipient[];
  filters: CampaignPeopleWorkspaceFilters;
}

export interface RecipientGroupUpsertInput {
  groupType: RecipientGroupType;
  groupName: string;
  intakeSource?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  status?: RecipientGroupStatus;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export interface GroupContactUpsertInput {
  contactRole: GroupContactRole;
  relationshipLabel?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredContact?: PreferredContact;
  isPrimary?: boolean;
  canPickUp?: boolean;
  isEmergencyContact?: boolean;
  notes?: string | null;
}

export interface RecipientUpsertInput {
  recipientGroupId: string;
  displayLabel: string;
  recipientKind?: RecipientKind;
  programType?: RecipientProgramType;
  privacyLevel?: RecipientPrivacyLevel;
  firstName?: string | null;
  lastName?: string | null;
  birthYear?: number | null;
  age?: number | null;
  gender?: string | null;
  directEmail?: string | null;
  directPhone?: string | null;
  facilityRoom?: string | null;
  subgroupLabel?: string | null;
  mobilityNotes?: string | null;
  notes?: string | null;
  status?: RecipientStatus;
}

export interface WishlistUpsertInput {
  wishlistStatus?: WishlistStatus;
  intakeMethod?: WishlistIntakeMethod | null;
  submittedAt?: string | null;
  intakeCompletedByContactId?: string | null;
  notes?: string | null;
}

export interface WishlistItemUpsertInput {
  category?: string | null;
  itemType?: WishlistItemType;
  description: string;
  size?: string | null;
  qtyRequested?: number | null;
  priority?: string;
  estCostCents?: number | null;
  allowSubstitute?: boolean;
  doNotSubstituteReason?: string | null;
  recipientNote?: string | null;
  notes?: string | null;
}
