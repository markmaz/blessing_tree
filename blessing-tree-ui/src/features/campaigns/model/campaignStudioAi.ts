import type {
  CampaignReadiness,
  CampaignScheduleItem,
  CampaignMilestone,
  CommunicationTemplate,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';
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
  if (selectedSection === 'readiness') {
    const starters = [
      'Fix the activation blockers for me.',
      'Explain what is currently blocking this campaign from activation.',
      'Tell me the fastest path to clear the current launch checks.',
      'Summarize the planning gaps that still need attention.',
    ];

    if (readiness.groups.blockers.length > 0) {
      starters.unshift('List the blockers and tell me the order I should fix them in.');
    }
    if (readiness.phaseStatus.activate === 'BLOCKED') {
      starters.unshift('Tell me exactly what I need to do to unblock campaign activation.');
    }
    if (readiness.phaseStatus.operations !== 'READY') {
      starters.push('Explain what still weakens operational readiness after this campaign goes live.');
    }
    if (readiness.groups.operational_health.length > 0) {
      starters.push('Summarize the current operational health warnings and why they matter.');
    }

    return Array.from(new Set(starters));
  }

  if (selectedSection === 'team') {
    return [
      'Set up a Warehouse Crew team with Lead, Runner, and Check-In roles.',
      'Add Chris Walker to Warehouse Crew as Check-In.',
      'Create a Sponsor Callers team with Caller and Lead roles.',
      'Explain what member type means in this campaign workspace.',
      'Explain the difference between app access, app access roles, and teams.',
      'Suggest how to organize volunteers into teams for this campaign.',
    ];
  }

  if (selectedSection === 'communications') {
    return [
      'Create a volunteer welcome template and place it on the registration open milestone.',
      'Draft a sponsor reminder email for November 10 and add it to the campaign calendar.',
      'Build pickup instructions for families and schedule them one week before pickup weekend.',
      'Create a thank-you email template for volunteers after the campaign closes.',
    ];
  }

  if (selectedSection === 'settings') {
    return [
      'Add a campaign description for this year.',
      'Set the campaign dates from November 1, 2026 through December 20, 2026.',
      'Activate this campaign when it is ready.',
      'Explain what happens when a campaign moves from DRAFT to ACTIVE.',
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
  if (selectedSection === 'readiness') {
    return [
      ...readiness.groups.blockers,
      ...readiness.groups.launch_checks,
      ...readiness.groups.planning_gaps,
      ...readiness.groups.operational_health,
    ].slice(0, 5);
  }

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

export function getAiPromptPlaceholder(selectedSection: CampaignStudioSectionId): string {
  if (selectedSection === 'schedule') {
    return 'Ask Campaign AI to draft or refine schedule changes for this campaign.';
  }

  if (selectedSection === 'team') {
    return 'Ask Campaign AI to build teams, team roles, and roster assignments or explain team concepts.';
  }

  if (selectedSection === 'communications') {
    return 'Ask Campaign AI to draft communication templates and place them on the campaign calendar.';
  }

  if (selectedSection === 'readiness') {
    return 'Ask Campaign AI to explain blockers or draft a fix bundle for readiness gaps.';
  }

  if (selectedSection === 'settings') {
    return 'Ask Campaign AI to draft campaign setting changes or explain lifecycle impacts.';
  }

  return 'Ask Campaign AI what to add or improve in this campaign workspace.';
}

export function getAiSuggestionHeading(selectedSection: CampaignStudioSectionId): string {
  if (selectedSection === 'team') {
    return 'What do you want to organize?';
  }

  if (selectedSection === 'readiness') {
    return 'What do you want clarified?';
  }

  if (selectedSection === 'communications') {
    return 'What do you want to draft?';
  }

  if (selectedSection === 'schedule') {
    return 'What do you want to place on the calendar?';
  }

  if (selectedSection === 'settings') {
    return 'What do you want to change?';
  }

  return 'What do you want to plan next?';
}

interface BuildAiAssistantResponseInput {
  campaign: Campaign;
  selectedSection: CampaignStudioSectionId;
  prompt: string;
  readiness: CampaignReadiness;
  scheduleItems: CampaignScheduleItem[];
  templates: CommunicationTemplate[];
  milestones: CampaignMilestone[];
  draftSummary?: string | null;
}

export function buildAiAssistantResponse({
  campaign,
  selectedSection,
  prompt,
  readiness,
  scheduleItems,
  templates,
  milestones,
  draftSummary = null,
}: BuildAiAssistantResponseInput): string {
  if (selectedSection === 'schedule') {
    const timingCount = scheduleItems.length;
    const milestoneCount = milestones.filter((milestone) => milestone.occursOn).length;
    const templateCount = templates.length;

    return [
      draftSummary
        ? `${draftSummary} is ready as a draft for ${campaign.name}.`
        : `I reviewed the schedule request for ${campaign.name}.`,
      `Current schedule context: ${timingCount} calendar item${timingCount === 1 ? '' : 's'}, ${milestoneCount} milestone date${milestoneCount === 1 ? '' : 's'}, and ${templateCount} communication template${templateCount === 1 ? '' : 's'}.`,
      'Use Apply Draft when the preview looks right.',
    ].join('\n\n');
  }

  if (selectedSection === 'team') {
    const normalizedPrompt = prompt.toLowerCase();
    const glossaryEntry = campaignTeamGlossaryEntries.find((entry) =>
      normalizedPrompt.includes(entry.label.toLowerCase())
    );

    if (glossaryEntry) {
      return [
        `${glossaryEntry.label} in ${campaign.name}:`,
        glossaryEntry.description,
        'Use the People table for roster records and app access. Use the Teams table and team drawer for operational grouping and team-specific roles.',
      ].join('\n\n');
    }

    return [
      `Campaign AI can help organize the ${campaign.name} roster into people, teams, and team roles.`,
      'App Access Roles control permissions in the app. Team Roles describe responsibilities inside a team. Plain team membership without a role still counts as Member participation.',
      'Use this panel to draft Team bundles like a new team, its roles, and roster assignments. Use the team drawer to refine the structure after apply.',
    ].join('\n\n');
  }

  if (selectedSection === 'readiness') {
    const blockerCount = readiness.groups.blockers.length;
    const launchCheckCount = readiness.groups.launch_checks.length;
    const planningGapCount = readiness.groups.planning_gaps.length;

    return [
      `${campaign.name} readiness is currently ${readiness.overallStatus.replaceAll('_', ' ').toLowerCase()}.`,
      `Current counts: ${blockerCount} blocker${blockerCount === 1 ? '' : 's'}, ${launchCheckCount} launch check${launchCheckCount === 1 ? '' : 's'}, and ${planningGapCount} planning gap${planningGapCount === 1 ? '' : 's'}.`,
      'Campaign AI can explain these findings or draft cross-section fixes for the ones it has enough information to resolve safely.',
    ].join('\n\n');
  }

  if (selectedSection === 'communications') {
    return [
      `Campaign AI can help shape the ${campaign.name} communication plan.`,
      `There ${templates.length === 1 ? 'is' : 'are'} currently ${templates.length} template${templates.length === 1 ? '' : 's'} available in this campaign.`,
      'Use this panel to draft new templates and optionally place them on the campaign calendar. Actual email delivery automation still is not wired yet.',
    ].join('\n\n');
  }

  if (selectedSection === 'settings') {
    return [
      `Campaign AI can help update lifecycle controls and setup decisions for ${campaign.name}.`,
      `Current status: ${campaign.status}. Campaign dates run from ${campaign.startDate} to ${campaign.endDate}.`,
      'Use Settings to draft metadata or status changes, then review Readiness before applying lifecycle moves like activation or closure.',
    ].join('\n\n');
  }

  return [
    `Campaign AI is focused on the ${selectedSection} section for ${campaign.name}.`,
    'Use the prompt suggestions and current signals to turn this section into a concrete next action.',
  ].join('\n\n');
}
