import type {
  CampaignPeopleGroupContact,
  GroupContactRole,
  PreferredContact,
  RecipientGroupStatus,
  RecipientGroupType,
  RecipientKind,
  RecipientPrivacyLevel,
  RecipientProgramType,
  RecipientStatus,
  WishlistIntakeMethod,
  WishlistItemType,
  WishlistStatus,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

export function toRecipientGroupTypeLabel(value: RecipientGroupType): string {
  if (value === 'HOUSEHOLD') {
    return 'Household';
  }
  return 'Adult Program';
}

export function toRecipientGroupStatusLabel(value: RecipientGroupStatus): string {
  return toTitleCase(value);
}

export function toRecipientProgramTypeLabel(value: RecipientProgramType): string {
  if (value === 'CHILD_FAMILY') {
    return 'Family Child';
  }
  return 'Adult Program Adult';
}

export function toRecipientKindLabel(value: RecipientKind): string {
  return value === 'CHILD' ? 'Child' : 'Adult';
}

export function toRecipientStatusLabel(value: RecipientStatus): string {
  return toTitleCase(value);
}

export function toRecipientPrivacyLevelLabel(value: RecipientPrivacyLevel): string {
  if (value === 'FULL_NAME') {
    return 'Full Name';
  }
  if (value === 'INITIALS') {
    return 'Initials';
  }
  return 'Anonymous';
}

export function toPreferredContactLabel(value: PreferredContact): string {
  return toTitleCase(value);
}

export function toGroupContactRoleLabel(value: GroupContactRole): string {
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

export function toWishlistStatusLabel(value: WishlistStatus): string {
  return toTitleCase(value);
}

export function toWishlistIntakeMethodLabel(value: WishlistIntakeMethod): string {
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

export function toWishlistItemTypeLabel(value: WishlistItemType): string {
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

export function toGiftWorkflowStatusLabel(isPickedUp: boolean, isFullyFulfilled: boolean, sponsorshipStatus: 'SPONSORED' | 'UNSPONSORED'): string {
  if (isPickedUp) {
    return 'Picked Up';
  }
  if (isFullyFulfilled) {
    return 'Ready for Pickup';
  }
  if (sponsorshipStatus === 'SPONSORED') {
    return 'Sponsored';
  }
  return 'Open';
}

export function formatContactDisplayName(contact: CampaignPeopleGroupContact | null): string {
  if (!contact) {
    return 'Unassigned';
  }
  return contact.displayName;
}

export function formatShortDate(value: string | null): string {
  if (!value) {
    return 'Not set';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCurrencyFromCents(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'Not set';
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}
