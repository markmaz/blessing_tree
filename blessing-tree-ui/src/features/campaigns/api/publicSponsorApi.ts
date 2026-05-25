import { apiFetchJson } from '@/shared/api/client';
import type {
  PublicSponsorAvailableItem,
  PublicSponsorConfig,
  PublicSponsorRegistrationInput,
  PublicSponsorRegistrationResult,
  PublicSponsorVerificationResult,
} from '@/features/campaigns/model/publicSponsorTypes';

interface PublicSponsorAvailableItemResponse {
  wishlist_item_id: string;
  description: string;
  category: string | null;
  item_type: string;
  size: string | null;
  qty_requested: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  recipient: {
    id: string;
    display_label: string;
    program_recipient_id: string | null;
  } | null;
}

interface PublicSponsorConfigResponse {
  campaign: {
    id: string;
    name: string;
    year: number;
    season_theme: string | null;
  };
  public_slug: string;
  signup_enabled: boolean;
  registration: {
    status: PublicSponsorConfig['registration']['status'];
    message: string;
    starts_on?: string | null;
    ends_on?: string | null;
    missing_milestones?: string[];
  };
  gift_deadline: string | null;
  selection_limit: number;
  whole_item_only: boolean;
  available_items: PublicSponsorAvailableItemResponse[];
}

interface PublicSponsorRegistrationResponse {
  pending_registration_id?: string;
  email?: string;
  status: string;
  email_delivery_status?: 'sent' | 'failed';
  expires_at?: string | null;
  verification_sent_at?: string | null;
  message: string;
}

interface PublicSponsorVerificationResponse {
  campaign: {
    id: string;
    name: string;
    year: number;
    season_theme: string | null;
  };
  registration: {
    id: string;
    status: string;
    verified_at: string | null;
    email: string;
  };
  sponsor: PublicSponsorVerificationSponsorResponse;
  gift_deadline: string | null;
  selection_limit: number;
  message: string;
}

interface PublicSponsorVerificationSponsorResponse {
  id: string;
  display_name: string;
  email: string | null;
  participation: {
    self_registered: boolean;
  };
  sponsored_items: Array<{
    id: string;
    gift: {
      description: string;
      category: string | null;
      item_type: string | null;
      size: string | null;
      qty_requested: number | null;
      status: string | null;
    } | null;
    recipient: {
      id: string;
      display_label: string;
      program_recipient_id: string | null;
    } | null;
  }>;
}

export async function getPublicSponsorConfig(publicSlug: string): Promise<PublicSponsorConfig> {
  const response = await apiFetchJson<PublicSponsorConfigResponse>(
    `/api/v1/public/campaigns/${publicSlug}/sponsor-config`
  );
  return {
    campaign: {
      id: response.campaign.id,
      name: response.campaign.name,
      year: response.campaign.year,
      seasonTheme: response.campaign.season_theme,
    },
    publicSlug: response.public_slug,
    signupEnabled: response.signup_enabled,
    registration: {
      status: response.registration.status,
      message: response.registration.message,
      startsOn: response.registration.starts_on ?? null,
      endsOn: response.registration.ends_on ?? null,
      missingMilestones: response.registration.missing_milestones ?? [],
    },
    giftDeadline: response.gift_deadline,
    selectionLimit: response.selection_limit,
    wholeItemOnly: response.whole_item_only,
    availableItems: response.available_items.map(mapAvailableItem),
  };
}

export async function submitPublicSponsorRegistration(
  publicSlug: string,
  input: PublicSponsorRegistrationInput
): Promise<PublicSponsorRegistrationResult> {
  const response = await apiFetchJson<PublicSponsorRegistrationResponse>(
    `/api/v1/public/campaigns/${publicSlug}/sponsors`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sponsor: {
          first_name: input.firstName,
          last_name: input.lastName,
          organization_name: input.organizationName || null,
          email: input.email,
          phone: input.phone || null,
          preferred_contact: input.preferredContact,
          address_line1: input.addressLine1 || null,
          address_line2: input.addressLine2 || null,
          city: input.city || null,
          state: input.state || null,
          postal_code: input.postalCode || null,
          notes: input.notes || null,
          source: input.source ?? 'PUBLIC_LINK',
        },
        selected_wishlist_item_ids: input.selectedWishlistItemIds,
        website: '',
      }),
    }
  );
  return {
    pendingRegistrationId: response.pending_registration_id,
    email: response.email,
    status: response.status,
    emailDeliveryStatus: response.email_delivery_status,
    expiresAt: response.expires_at ?? null,
    verificationSentAt: response.verification_sent_at ?? null,
    message: response.message,
  };
}

export async function verifyPublicSponsorRegistration(
  publicSlug: string,
  token: string
): Promise<PublicSponsorVerificationResult> {
  const response = await apiFetchJson<PublicSponsorVerificationResponse>(
    `/api/v1/public/campaigns/${publicSlug}/sponsors/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }
  );
  return {
    campaign: {
      id: response.campaign.id,
      name: response.campaign.name,
      year: response.campaign.year,
      seasonTheme: response.campaign.season_theme,
    },
    registration: {
      id: response.registration.id,
      status: response.registration.status,
      verifiedAt: response.registration.verified_at,
      email: response.registration.email,
    },
    sponsor: mapVerificationSponsor(response.sponsor),
    giftDeadline: response.gift_deadline,
    selectionLimit: response.selection_limit,
    message: response.message,
  };
}

export async function commitVerifiedPublicSponsorGifts(
  publicSlug: string,
  token: string,
  selectedWishlistItemIds: string[]
): Promise<PublicSponsorVerificationResult> {
  const response = await apiFetchJson<PublicSponsorVerificationResponse>(
    `/api/v1/public/campaigns/${publicSlug}/sponsors/verified-gifts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        selected_wishlist_item_ids: selectedWishlistItemIds,
      }),
    }
  );
  return {
    campaign: {
      id: response.campaign.id,
      name: response.campaign.name,
      year: response.campaign.year,
      seasonTheme: response.campaign.season_theme,
    },
    registration: {
      id: response.registration.id,
      status: response.registration.status,
      verifiedAt: response.registration.verified_at,
      email: response.registration.email,
    },
    sponsor: mapVerificationSponsor(response.sponsor),
    giftDeadline: response.gift_deadline,
    selectionLimit: response.selection_limit,
    message: response.message,
  };
}

function mapAvailableItem(item: PublicSponsorAvailableItemResponse): PublicSponsorAvailableItem {
  return {
    wishlistItemId: item.wishlist_item_id,
    description: item.description,
    category: item.category,
    itemType: item.item_type,
    size: item.size,
    qtyRequested: item.qty_requested,
    priority: item.priority,
    recipient: item.recipient
      ? {
          id: item.recipient.id,
          displayLabel: item.recipient.display_label,
          programRecipientId: item.recipient.program_recipient_id,
        }
      : null,
  };
}

function mapVerificationSponsor(
  sponsor: PublicSponsorVerificationSponsorResponse
): PublicSponsorVerificationResult['sponsor'] {
  return {
    id: sponsor.id,
    displayName: sponsor.display_name,
    email: sponsor.email,
    participation: {
      selfRegistered: sponsor.participation.self_registered,
    },
    sponsoredItems: sponsor.sponsored_items.map((item) => ({
      id: item.id,
      gift: item.gift
        ? {
            description: item.gift.description,
            category: item.gift.category,
            itemType: item.gift.item_type ?? 'GIFT',
            size: item.gift.size,
            qtyRequested: item.gift.qty_requested ?? 1,
            status: item.gift.status ?? 'COMMITTED',
          }
        : null,
      recipient: item.recipient
        ? {
            id: item.recipient.id,
            displayLabel: item.recipient.display_label,
            programRecipientId: item.recipient.program_recipient_id,
          }
        : null,
    })),
  };
}
