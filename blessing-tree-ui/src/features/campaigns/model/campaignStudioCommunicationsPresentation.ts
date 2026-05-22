import type {
  CommunicationAudienceKey,
  CommunicationAudienceOption,
} from '@/features/campaigns/model/campaignStudioTypes';

const fallbackAudienceCatalog: CommunicationAudienceOption[] = [
  {
    key: 'HOUSEHOLD_CONTACT',
    label: 'Household Contacts',
    description: 'Parents and guardians connected to household recipient groups.',
  },
  {
    key: 'CARE_FACILITY_CONTACT',
    label: 'Facility Contacts',
    description: 'Staff and social-worker contacts connected to care-facility groups.',
  },
  {
    key: 'GROUP_PRIMARY_CONTACT',
    label: 'Primary Group Contacts',
    description: 'The primary coordination contact for each recipient group.',
  },
  {
    key: 'ADULT_RECIPIENT_DIRECT',
    label: 'Direct Adult Recipients',
    description: 'Adult recipients who have their own direct email address on file.',
  },
  {
    key: 'SPONSOR',
    label: 'Sponsors',
    description: 'Sponsors connected to this campaign through active sponsorships.',
  },
  {
    key: 'VOLUNTEER',
    label: 'Volunteers',
    description: 'Campaign roster members marked as volunteers.',
  },
  {
    key: 'MANAGER',
    label: 'Campaign Managers',
    description: 'People with the Campaign Manager app access role in this campaign.',
  },
  {
    key: 'GENERAL',
    label: 'Campaign Members',
    description: 'All active campaign roster members with an email address.',
  },
];

export function getCommunicationAudienceCatalog(
  catalog: CommunicationAudienceOption[]
): CommunicationAudienceOption[] {
  return catalog.length > 0 ? catalog : fallbackAudienceCatalog;
}

export function getCommunicationAudienceOption(
  audience: CommunicationAudienceKey,
  catalog: CommunicationAudienceOption[]
): CommunicationAudienceOption {
  return (
    getCommunicationAudienceCatalog(catalog).find((option) => option.key === audience) ??
    fallbackAudienceCatalog.find((option) => option.key === audience) ??
    {
      key: audience,
      label: audience,
      description: audience,
    }
  );
}

export function getCommunicationAudienceLabel(
  audience: CommunicationAudienceKey,
  catalog: CommunicationAudienceOption[]
): string {
  return getCommunicationAudienceOption(audience, catalog).label;
}
