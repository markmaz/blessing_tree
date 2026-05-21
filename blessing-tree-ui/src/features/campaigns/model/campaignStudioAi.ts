import type {
  CampaignReadiness,
  CampaignScheduleItem,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import {
  campaignTeamGlossaryEntries,
  type CampaignTeamGlossaryEntry,
} from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';

const defaultPromptStarters = [
  'Create a sponsor reminder sequence for this campaign.',
  'Suggest the missing milestone dates before launch.',
  'Draft the volunteer and manager roles this campaign still needs.',
  'Build a readiness checklist for opening this campaign.',
] as const;

export function getAiPromptStarters(
  selectedSection: CampaignStudioSectionId,
  readiness: CampaignReadiness,
  scheduleItems: CampaignScheduleItem[]
): string[] {
  if (selectedSection === 'team') {
    return [
      'Explain what member type means in this campaign workspace.',
      'Explain the difference between app access, app access roles, and teams.',
      'Suggest how to organize volunteers into teams for this campaign.',
      'List the people and team structure this campaign probably needs.',
    ];
  }

  if (selectedSection !== 'schedule') {
    return [...defaultPromptStarters];
  }

  const starters: string[] = [];
  const readinessCodes = new Set(readiness.items.map((item) => item.code));

  if (readinessCodes.has('missing_manual_schedule')) {
    starters.push(
      'Add volunteer orientation, sorting, and pickup planning blocks to this campaign schedule.'
    );
  }
  if (readinessCodes.has('missing_schedule_messaging')) {
    starters.push(
      'Map reminder emails to the milestone dates already on this campaign calendar.'
    );
  }
  if (scheduleItems.length === 0) {
    starters.push(
      'Draft the first milestone, communication, and manual planning events for this campaign.'
    );
  }

  starters.push(
    'Lay out a pickup and volunteer schedule across the campaign calendar.',
    'Suggest where sponsor reminders should land relative to the key milestones.',
    'Build a practical pre-launch schedule for this campaign team.'
  );

  return Array.from(new Set(starters));
}

export function getAiReadinessSignals(
  selectedSection: CampaignStudioSectionId,
  readiness: CampaignReadiness
): CampaignReadiness['items'] {
  if (selectedSection === 'schedule') {
    return readiness.items.filter((item) => item.section === 'schedule');
  }

  return readiness.items.filter((item) => item.section === selectedSection).slice(0, 3);
}

export function getAiTeamGlossary(
  selectedSection: CampaignStudioSectionId
): CampaignTeamGlossaryEntry[] {
  if (selectedSection !== 'team') {
    return [];
  }

  return campaignTeamGlossaryEntries;
}
