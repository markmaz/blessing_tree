export type CampaignStudioSectionId =
  | 'overview'
  | 'team'
  | 'communications'
  | 'dates'
  | 'readiness'
  | 'settings';

export interface CampaignStudioSection {
  id: CampaignStudioSectionId;
  label: string;
  icon: string;
  description: string;
}

export const campaignStudioSections: CampaignStudioSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'bi-grid-1x2',
    description: 'Full campaign snapshot and readiness.',
  },
  {
    id: 'team',
    label: 'Team',
    icon: 'bi-people',
    description: 'Managers, coordinators, and volunteers.',
  },
  {
    id: 'communications',
    label: 'Communications',
    icon: 'bi-envelope-paper',
    description: 'Templates, reminders, and campaign messaging.',
  },
  {
    id: 'dates',
    label: 'Dates',
    icon: 'bi-calendar-event',
    description: 'Milestones, intake windows, and pickup dates.',
  },
  {
    id: 'readiness',
    label: 'Readiness',
    icon: 'bi-clipboard-check',
    description: 'Gaps, blockers, and launch checks.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'bi-sliders',
    description: 'Metadata, lifecycle, and campaign controls.',
  },
];

export const campaignStudioPromptStarters = [
  'Create a sponsor reminder sequence for this campaign.',
  'Suggest the missing milestone dates before launch.',
  'Draft the volunteer and manager roles this campaign still needs.',
  'Build a readiness checklist for opening this campaign.',
] as const;
