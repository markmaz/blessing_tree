import {
  milestoneDefinitions,
} from '@/features/campaigns/model/campaignStudio';
import {
  type CampaignMilestone,
  type CommunicationTemplate,
  type CreateCampaignEventInput,
  type CreateCommunicationScheduleInput,
  type SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';

export type ScheduleAiDraftType = 'event' | 'milestone' | 'communication';

export interface ScheduleAiDraftRequest {
  prompt: string;
  requestedType: ScheduleAiDraftType;
  milestones: CampaignMilestone[];
  templates: CommunicationTemplate[];
}

export interface ScheduleAiDraftResult {
  summary: string;
  type: ScheduleAiDraftType;
  eventInput?: CreateCampaignEventInput;
  milestoneInput?: SaveCampaignMilestoneInput;
  communicationInput?: CreateCommunicationScheduleInput;
}

export function buildScheduleAiDraft(
  request: ScheduleAiDraftRequest
): ScheduleAiDraftResult {
  const prompt = request.prompt.trim();
  if (!prompt) {
    throw new Error('Add a short prompt before drafting a calendar change.');
  }

  if (request.requestedType === 'event') {
    return buildEventDraft(prompt);
  }

  if (request.requestedType === 'milestone') {
    return buildMilestoneDraft(prompt, request.milestones);
  }

  return buildCommunicationDraft(prompt, request.templates);
}

function buildEventDraft(prompt: string): ScheduleAiDraftResult {
  const timing = extractDateTime(prompt);
  if (!timing.dateKey) {
    throw new Error('Include a date like 2026-11-15 or Nov 15 so AI can place the event.');
  }

  const title = extractTitle(prompt, 'Planning Event');
  const eventType = detectEventType(prompt);
  const startAt = timing.timeText
    ? `${timing.dateKey}T${timing.timeText}`
    : `${timing.dateKey}T00:00`;
  const endAt = timing.timeText ? null : `${timing.dateKey}T00:00`;

  return {
    type: 'event',
    summary: `${title} on ${timing.dateKey}`,
    eventInput: {
      title,
      eventType,
      startAt,
      endAt,
      allDay: !timing.timeText,
      notes: prompt,
    },
  };
}

function buildMilestoneDraft(
  prompt: string,
  milestones: CampaignMilestone[]
): ScheduleAiDraftResult {
  const timing = extractDateTime(prompt);
  if (!timing.dateKey) {
    throw new Error('Include a date like 2026-10-01 or Oct 1 so AI can place the milestone.');
  }

  const definition = matchMilestoneDefinition(prompt);
  if (!definition) {
    throw new Error('Mention which milestone to place, like registration open or pickup start.');
  }

  const existing = milestones.find((milestone) => milestone.milestoneKey === definition.key);

  return {
    type: 'milestone',
    summary: `${definition.label} on ${timing.dateKey}`,
    milestoneInput: {
      milestoneKey: definition.key,
      label: definition.label,
      occursOn: timing.dateKey,
      notes: existing?.notes ?? prompt,
      sortOrder: definition.sortOrder,
    },
  };
}

function buildCommunicationDraft(
  prompt: string,
  templates: CommunicationTemplate[]
): ScheduleAiDraftResult {
  const template = matchTemplate(prompt, templates);
  if (!template) {
    throw new Error('Mention a known template name so AI knows which communication to schedule.');
  }

  const milestone = matchMilestoneDefinition(prompt);
  const timing = extractDateTime(prompt);
  if (!milestone && !timing.dateKey) {
    throw new Error(
      'Include either a milestone reference or a concrete send date so AI can place the communication.'
    );
  }

  return {
    type: 'communication',
    summary: `${template.name} ${milestone ? `at ${milestone.label}` : `on ${timing.dateKey}`}`,
    communicationInput: {
      templateId: template.id,
      milestoneKey: milestone?.key ?? null,
      scheduledFor: timing.dateKey
        ? `${timing.dateKey}T${timing.timeText ?? '09:00'}`
        : null,
      status: timing.dateKey ? 'SCHEDULED' : 'DRAFT',
      notes: prompt,
    },
  };
}

function extractTitle(prompt: string, fallback: string): string {
  const quotedMatch = prompt.match(/"([^"]+)"/);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const cleaned = prompt
    .replace(/\b(add|create|schedule|plan|draft)\b/gi, '')
    .replace(/\bon\b.+$/i, '')
    .replace(/\bfor\b.+$/i, '')
    .trim();

  return cleaned ? toTitleCase(cleaned) : fallback;
}

function detectEventType(prompt: string): CreateCampaignEventInput['eventType'] {
  const normalizedPrompt = prompt.toLowerCase();
  if (normalizedPrompt.includes('volunteer')) {
    return 'VOLUNTEER';
  }
  if (normalizedPrompt.includes('sponsor')) {
    return 'SPONSOR';
  }
  if (normalizedPrompt.includes('pickup')) {
    return 'PICKUP';
  }
  if (normalizedPrompt.includes('gift')) {
    return 'GIFT';
  }
  if (normalizedPrompt.includes('donation')) {
    return 'DONATION';
  }
  if (normalizedPrompt.includes('recipient') || normalizedPrompt.includes('family')) {
    return 'RECIPIENT';
  }
  if (normalizedPrompt.includes('communicat') || normalizedPrompt.includes('email')) {
    return 'COMMUNICATION';
  }
  return 'GENERAL';
}

function matchMilestoneDefinition(prompt: string) {
  const normalizedPrompt = normalizeText(prompt);
  return milestoneDefinitions.find((definition) =>
    normalizedPrompt.includes(normalizeText(definition.label)) ||
    normalizedPrompt.includes(definition.key.replaceAll('_', ' '))
  );
}

function matchTemplate(
  prompt: string,
  templates: CommunicationTemplate[]
): CommunicationTemplate | null {
  const normalizedPrompt = normalizeText(prompt);
  const exactMatch = templates.find((template) =>
    normalizedPrompt.includes(normalizeText(template.name)) ||
    normalizedPrompt.includes(template.templateKey.replaceAll('_', ' '))
  );
  return exactMatch ?? (templates.length === 1 ? templates[0] : null);
}

function extractDateTime(prompt: string): { dateKey: string | null; timeText: string | null } {
  const isoMatch = prompt.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return {
      dateKey: isoMatch[1],
      timeText: extractTime(prompt),
    };
  }

  const slashMatch = prompt.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return {
      dateKey: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      timeText: extractTime(prompt),
    };
  }

  const monthMatch = prompt.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(20\d{2}))?/i
  );
  if (monthMatch) {
    const [, monthName, day, yearText] = monthMatch;
    const monthIndex = monthNames.indexOf(monthName.toLowerCase()) + 1;
    const year = yearText ?? '2026';
    return {
      dateKey: `${year}-${String(monthIndex).padStart(2, '0')}-${day.padStart(2, '0')}`,
      timeText: extractTime(prompt),
    };
  }

  return { dateKey: null, timeText: null };
}

function extractTime(prompt: string): string | null {
  const twentyFourHourMatch = prompt.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHourMatch) {
    return `${twentyFourHourMatch[1].padStart(2, '0')}:${twentyFourHourMatch[2]}`;
  }

  const twelveHourMatch = prompt.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!twelveHourMatch) {
    return null;
  }

  const [, hourText, minuteText = '00', meridiem] = twelveHourMatch;
  let hour = Number(hourText) % 12;
  if (meridiem.toLowerCase() === 'pm') {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${minuteText}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const monthNames: string[] = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;
