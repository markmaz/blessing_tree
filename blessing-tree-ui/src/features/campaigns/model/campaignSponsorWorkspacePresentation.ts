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

export function summarizeFollowUp(interactions: CampaignSponsorInteraction[]): string {
  const pending = interactions.filter((interaction) => interaction.followUpAt);
  if (pending.length === 0) {
    return 'No follow-up scheduled';
  }
  const nextItem = [...pending]
    .sort((left, right) => (left.followUpAt ?? '').localeCompare(right.followUpAt ?? ''))[0];
  return `Next follow-up ${formatShortDate(nextItem.followUpAt)}`;
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
