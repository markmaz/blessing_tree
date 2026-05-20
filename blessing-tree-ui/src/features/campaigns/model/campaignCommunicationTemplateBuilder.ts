import type {
  CommunicationTemplate,
  CreateCommunicationTemplateInput,
  UpdateCommunicationTemplateInput,
} from '@/features/campaigns/model/campaignStudioTypes';

export interface CommunicationTemplateDraft {
  templateKey: string;
  name: string;
  audience: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
}

export interface TemplateMergeFieldGroup {
  label: string;
  fields: string[];
}

const mergeFieldPattern = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;

const previewContext: Record<string, string> = {
  'campaign.name': 'Blessing Tree 2026 Demo',
  'campaign.year': '2026',
  'campaign.start_date': 'November 1, 2026',
  'campaign.end_date': 'December 20, 2026',
  'organization.name': 'Blessing Tree',
  'manager.name': 'Jordan Manager',
  'recipient.first_name': 'Ava',
  'recipient.full_name': 'Ava Johnson',
  'sponsor.first_name': 'Taylor',
  'sponsor.full_name': 'Taylor Reed',
  'volunteer.first_name': 'Chris',
  'volunteer.full_name': 'Chris Walker',
  'milestone.label': 'Pickup Weekend',
  'milestone.date': 'December 19, 2026',
  'event.title': 'Volunteer Orientation',
  'event.start_at': 'November 3, 2026 at 6:00 PM',
};

export const communicationTemplateMergeFieldGroups: TemplateMergeFieldGroup[] = [
  {
    label: 'Campaign',
    fields: [
      'campaign.name',
      'campaign.year',
      'campaign.start_date',
      'campaign.end_date',
      'organization.name',
    ],
  },
  {
    label: 'People',
    fields: [
      'recipient.first_name',
      'recipient.full_name',
      'sponsor.first_name',
      'sponsor.full_name',
      'volunteer.first_name',
      'volunteer.full_name',
      'manager.name',
    ],
  },
  {
    label: 'Schedule',
    fields: [
      'milestone.label',
      'milestone.date',
      'event.title',
      'event.start_at',
    ],
  },
];

export function createBlankCommunicationTemplateDraft(): CommunicationTemplateDraft {
  return {
    templateKey: '',
    name: '',
    audience: 'GENERAL',
    subjectTemplate: '',
    bodyTemplate: '',
    isActive: true,
  };
}

export function draftFromCommunicationTemplate(
  template: CommunicationTemplate
): CommunicationTemplateDraft {
  return {
    templateKey: template.templateKey,
    name: template.name,
    audience: template.audience,
    subjectTemplate: template.subjectTemplate,
    bodyTemplate: template.bodyTemplate,
    isActive: template.isActive,
  };
}

export function normalizeTemplateKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

export function deriveTemplateKey(name: string): string {
  return normalizeTemplateKey(name);
}

export function toCreateTemplateInput(
  draft: CommunicationTemplateDraft
): CreateCommunicationTemplateInput {
  return {
    templateKey: normalizeTemplateKey(draft.templateKey || draft.name),
    name: draft.name.trim(),
    audience: draft.audience,
    subjectTemplate: draft.subjectTemplate.trim(),
    bodyTemplate: draft.bodyTemplate.trim(),
    isActive: draft.isActive,
  };
}

export function toUpdateTemplateInput(
  draft: CommunicationTemplateDraft
): UpdateCommunicationTemplateInput {
  return {
    templateKey: normalizeTemplateKey(draft.templateKey || draft.name),
    name: draft.name.trim(),
    audience: draft.audience,
    subjectTemplate: draft.subjectTemplate.trim(),
    bodyTemplate: draft.bodyTemplate.trim(),
    isActive: draft.isActive,
  };
}

export function renderTemplatePreview(value: string): string {
  return value.replace(
    mergeFieldPattern,
    (_match, field: string) => previewContext[field] ?? `{{${field}}}`
  );
}

export function renderTemplatePreviewParagraphs(value: string): string[] {
  const rendered = renderTemplatePreview(value);
  return rendered
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
