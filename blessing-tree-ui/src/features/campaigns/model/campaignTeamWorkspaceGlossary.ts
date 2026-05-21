export interface CampaignTeamGlossaryEntry {
  key: string;
  label: string;
  shortLabel?: string;
  description: string;
}

export const campaignTeamGlossaryEntries: CampaignTeamGlossaryEntry[] = [
  {
    key: 'member_type',
    label: 'Member Type',
    description:
      'A campaign-level roster label such as staff, volunteer, contact, or external. It helps with filtering and organization, but it does not grant app permissions.',
  },
  {
    key: 'app_access',
    label: 'App Access',
    description:
      'Whether this person is linked to an app user or invitation flow. People can stay in the campaign roster without any app access at all.',
  },
  {
    key: 'app_access_roles',
    label: 'App Access Roles',
    shortLabel: 'Access Roles',
    description:
      'Fixed permission bundles used by the app. These control what someone can do inside Blessing Tree and are separate from team membership.',
  },
  {
    key: 'teams',
    label: 'Teams',
    description:
      'Operational groups such as Warehouse Crew or Sponsor Callers. Teams help organize work and will be usable for communications audiences.',
  },
  {
    key: 'team_roles',
    label: 'Team Roles',
    description:
      'Responsibilities inside a specific team, such as Lead or Caller. Team roles are operational labels, not app permissions.',
  },
] as const;

export function getCampaignTeamGlossaryEntry(
  key: CampaignTeamGlossaryEntry['key']
): CampaignTeamGlossaryEntry {
  const entry = campaignTeamGlossaryEntries.find((item) => item.key === key);
  if (!entry) {
    throw new Error(`Unknown campaign team glossary entry: ${key}`);
  }
  return entry;
}
