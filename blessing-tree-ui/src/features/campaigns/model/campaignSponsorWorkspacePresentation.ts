import type {
  CampaignSponsor,
  CampaignSponsorInteraction,
  SponsorInteractionOrigin,
  SponsorPreferredContact,
  SponsorshipDropOffStatus,
  SponsorshipInterestStatus,
  SponsorshipStatus,
} from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import { formatCurrencyFromCents, formatPhoneNumber, formatShortDate } from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';

export { formatPhoneNumber, formatShortDate, formatCurrencyFromCents };

export function toSponsorStatusLabel(value: SponsorshipStatus): string {
  return toTitleCase(value);
}

export function toSponsorInterestStatusLabel(value: SponsorshipInterestStatus): string {
  return toTitleCase(value);
}

export function toSponsorDropOffStatusLabel(value: SponsorshipDropOffStatus): string {
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

export function toSponsorPreferredContactLabel(value: SponsorPreferredContact): string {
  return toTitleCase(value);
}

export function toSponsorInteractionOriginLabel(value: SponsorInteractionOrigin): string {
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

export function summarizeSponsorInteraction(interaction: CampaignSponsorInteraction | null | undefined): string {
  if (!interaction) {
    return 'No interactions recorded';
  }
  const parts = [
    toTitleCase(interaction.channel),
    toTitleCase(interaction.outcome),
    interaction.subject,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function getMostRecentSponsorInteraction(
  interactions: CampaignSponsorInteraction[]
): CampaignSponsorInteraction | null {
  if (interactions.length === 0) {
    return null;
  }
  return [...interactions].sort(
    (left, right) => dateSortValue(right.occurredAt) - dateSortValue(left.occurredAt)
  )[0];
}

export function formatSponsorInteractionDateTime(value: string | null): string {
  if (!value) {
    return 'Not set';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function toSponsorDisplaySubtitle(sponsor: CampaignSponsor): string {
  const parts = [
    sponsor.organizationName,
    sponsor.email,
    sponsor.phone ? formatPhoneNumber(sponsor.phone) : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'No contact details yet';
}

export function summarizeSponsorGiftItems(sponsor: CampaignSponsor): string {
  if (sponsor.sponsoredItems.length === 0) {
    return 'No sponsored gifts yet';
  }
  return `${sponsor.sponsoredItems.length} gift${sponsor.sponsoredItems.length === 1 ? '' : 's'} linked`;
}

export function needsSponsorFollowUp(sponsor: CampaignSponsor): boolean {
  return !sponsor.lastContactedAt || getNextSponsorFollowUpAt(sponsor) !== null;
}

export function compareSponsorFollowUpQueue(left: CampaignSponsor, right: CampaignSponsor): number {
  const leftNextFollowUp = getNextSponsorFollowUpAt(left);
  const rightNextFollowUp = getNextSponsorFollowUpAt(right);

  if (leftNextFollowUp && rightNextFollowUp) {
    const comparison = dateSortValue(leftNextFollowUp) - dateSortValue(rightNextFollowUp);
    return comparison === 0 ? left.displayName.localeCompare(right.displayName) : comparison;
  }

  if (leftNextFollowUp) {
    return -1;
  }

  if (rightNextFollowUp) {
    return 1;
  }

  if (!left.lastContactedAt && right.lastContactedAt) {
    return -1;
  }

  if (left.lastContactedAt && !right.lastContactedAt) {
    return 1;
  }

  return left.displayName.localeCompare(right.displayName, undefined, { numeric: true, sensitivity: 'base' });
}

export function summarizeSponsorFollowUpQueue(sponsor: CampaignSponsor): string {
  const nextFollowUp = getNextSponsorFollowUpAt(sponsor);
  if (nextFollowUp) {
    return `Next follow-up ${formatShortDate(nextFollowUp)}`;
  }

  if (!sponsor.lastContactedAt) {
    return 'No contact recorded';
  }

  return 'No follow-up scheduled';
}

export function summarizeFollowUp(interactions: CampaignSponsorInteraction[]): string {
  const pending = interactions.filter((interaction) => interaction.followUpAt);
  if (pending.length === 0) {
    return 'No follow-up scheduled';
  }
  const nextItem = [...pending]
    .sort((left, right) => (left.followUpAt ?? '').localeCompare(right.followUpAt ?? ''))[0];
  return `Next follow-up ${formatShortDate(nextItem.followUpAt)}`;
}

function getNextSponsorFollowUpAt(sponsor: CampaignSponsor): string | null {
  const pending = sponsor.recentInteractions
    .map((interaction) => interaction.followUpAt)
    .filter((value): value is string => Boolean(value));
  if (pending.length === 0) {
    return null;
  }
  return pending.sort((left, right) => dateSortValue(left) - dateSortValue(right))[0];
}

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((segment) => `${segment.slice(0, 1)}${segment.slice(1).toLowerCase()}`)
    .join(' ');
}

function dateSortValue(value: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
