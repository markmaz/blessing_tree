export interface PublicSponsorAvailableItem {
  wishlistItemId: string;
  description: string;
  category: string | null;
  itemType: string;
  size: string | null;
  qtyRequested: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  recipient: {
    id: string;
    displayLabel: string;
    programRecipientId: string | null;
  } | null;
}

export interface PublicSponsorRegistrationState {
  status: 'OPEN' | 'NOT_OPEN' | 'CLOSED' | 'DISABLED' | 'BLOCKED';
  message: string;
  startsOn?: string | null;
  endsOn?: string | null;
  missingMilestones?: string[];
}

export interface PublicSponsorConfig {
  campaign: {
    id: string;
    name: string;
    year: number;
    seasonTheme: string | null;
  };
  publicSlug: string;
  signupEnabled: boolean;
  registration: PublicSponsorRegistrationState;
  giftDeadline: string | null;
  selectionLimit: number;
  wholeItemOnly: boolean;
  availableItems: PublicSponsorAvailableItem[];
}

export interface PublicSponsorRegistrationInput {
  firstName: string;
  lastName: string;
  organizationName: string;
  email: string;
  phone: string;
  preferredContact: 'EMAIL' | 'PHONE' | 'TEXT' | 'NONE';
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
  selectedWishlistItemIds: string[];
  source?: 'PUBLIC_LINK' | 'PUBLIC_QR';
}

export interface PublicSponsorRegistrationResult {
  pendingRegistrationId?: string;
  email?: string;
  status: string;
  emailDeliveryStatus?: 'sent' | 'failed';
  expiresAt?: string | null;
  verificationSentAt?: string | null;
  message: string;
}

export interface PublicSponsorVerificationResult {
  campaign: {
    id: string;
    name: string;
    year: number;
    seasonTheme: string | null;
  };
  registration: {
    id: string;
    status: string;
    verifiedAt: string | null;
    email: string;
  };
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
    participation: {
      selfRegistered: boolean;
    };
    sponsoredItems: Array<{
      id: string;
      gift: {
        description: string;
        category: string | null;
        itemType: string;
        size: string | null;
        qtyRequested: number;
        status: string;
      } | null;
      recipient: {
        id: string;
        displayLabel: string;
        programRecipientId: string | null;
      } | null;
    }>;
  };
  giftDeadline: string | null;
  selectionLimit: number;
  message: string;
}
