import type {
  CampaignPeopleGroupContact,
  GroupContactRole,
  PreferredContact,
  RecipientGroupStatus,
  RecipientGroupType,
  RecipientAgeUnit,
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
  return 'Organization';
}

export function toRecipientGroupStatusLabel(value: RecipientGroupStatus): string {
  return toTitleCase(value);
}

export function toRecipientProgramTypeLabel(value: RecipientProgramType): string {
  if (value === 'CHILD_FAMILY') {
    return 'Family Child';
  }
  if (value === 'ORGANIZATION_CHILD') {
    return 'Organization Child';
  }
  return 'Organization Adult';
}

export function toRecipientKindLabel(value: RecipientKind): string {
  return value === 'CHILD' ? 'Child' : 'Adult';
}

export function formatRecipientAge(age: number | null, ageUnit?: RecipientAgeUnit | null): string {
  if (age === null || age === undefined) {
    return 'Not set';
  }
  const normalizedUnit = ageUnit ?? 'YEARS';
  const unitLabel =
    normalizedUnit === 'MONTHS'
      ? age === 1
        ? 'month'
        : 'months'
      : age === 1
        ? 'year'
        : 'years';
  return `${age} ${unitLabel}`;
}

export function recipientAgeSortValue(age: number | null, ageUnit?: RecipientAgeUnit | null): number {
  if (age === null || age === undefined) {
    return -1;
  }
  return (ageUnit ?? 'YEARS') === 'MONTHS' ? age : age * 12;
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

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatPhoneNumber(value: string | null): string {
  if (!value) {
    return 'Not set';
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
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
