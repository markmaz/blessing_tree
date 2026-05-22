import type {
  CommunicationAudienceKey,
  CommunicationTemplate,
  CreateCommunicationTemplateInput,
  UpdateCommunicationTemplateInput,
} from '@/features/campaigns/model/campaignStudioTypes';

const templateBlocksPrefix = '__bt_template_blocks_v1__::';
const mergeFieldPattern = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;

export type CommunicationTemplateBlockType = 'heading' | 'text' | 'image';

export interface CommunicationTemplateHeadingBlock {
  id: string;
  type: 'heading';
  content: string;
}

export interface CommunicationTemplateTextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface CommunicationTemplateImageBlock {
  id: string;
  type: 'image';
  src: string;
  altText: string;
  caption: string;
}

export type CommunicationTemplateBlock =
  | CommunicationTemplateHeadingBlock
  | CommunicationTemplateTextBlock
  | CommunicationTemplateImageBlock;

export interface CommunicationTemplateDraft {
  templateKey: string;
  name: string;
  audience: CommunicationAudienceKey;
  subjectTemplate: string;
  bodyBlocks: CommunicationTemplateBlock[];
  isActive: boolean;
}

export interface TemplateMergeFieldGroup {
  label: string;
  fields: string[];
}

export interface CommunicationTemplateFocusTarget {
  kind: 'subject' | 'block';
  blockId?: string;
  field?: 'content' | 'src' | 'altText' | 'caption';
}

const previewContext: Record<string, string> = {
  'campaign.name': 'Blessing Tree 2026 Demo',
  'campaign.year': '2026',
  'campaign.start_date': 'November 1, 2026',
  'campaign.end_date': 'December 20, 2026',
  'organization.name': 'Blessing Tree',
  'manager.name': 'Jordan Manager',
  'contact.first_name': 'Pat',
  'contact.full_name': 'Pat Coordinator',
  'group.name': 'Johnson Household',
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
  'location.map_url': 'https://maps.example.com/pickup-warehouse',
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
      'contact.first_name',
      'contact.full_name',
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
      'location.map_url',
    ],
  },
];

export function createBlankCommunicationTemplateDraft(): CommunicationTemplateDraft {
  return {
    templateKey: '',
    name: '',
    audience: 'GENERAL',
    subjectTemplate: '',
    bodyBlocks: [createTemplateBlock('text')],
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
    bodyBlocks: parseTemplateBody(template.bodyTemplate),
    isActive: template.isActive,
  };
}

export function parseStoredTemplateBlocks(bodyTemplate: string): CommunicationTemplateBlock[] {
  return parseTemplateBody(bodyTemplate);
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

export function createTemplateBlock(
  type: CommunicationTemplateBlockType
): CommunicationTemplateBlock {
  if (type === 'heading') {
    return {
      id: createTemplateBlockId(),
      type,
      content: '',
    };
  }
  if (type === 'image') {
    return {
      id: createTemplateBlockId(),
      type,
      src: '',
      altText: '',
      caption: '',
    };
  }
  return {
    id: createTemplateBlockId(),
    type,
    content: '',
  };
}

export function getTemplateBlockLabel(type: CommunicationTemplateBlockType): string {
  if (type === 'heading') {
    return 'Heading';
  }
  if (type === 'image') {
    return 'Image';
  }
  return 'Text';
}

export function getTemplateBlockIcon(type: CommunicationTemplateBlockType): string {
  if (type === 'heading') {
    return 'bi-type-h1';
  }
  if (type === 'image') {
    return 'bi-image';
  }
  return 'bi-text-paragraph';
}

export function getTemplateBodySummary(template: CommunicationTemplate): string {
  const blocks = parseTemplateBody(template.bodyTemplate);
  const firstFilledBlock = blocks.find((block) => {
    if (block.type === 'image') {
      return Boolean(block.caption.trim() || block.altText.trim() || block.src.trim());
    }
    return Boolean(block.content.trim());
  });

  if (!firstFilledBlock) {
    return 'No body content yet.';
  }

  if (firstFilledBlock.type === 'image') {
    return firstFilledBlock.caption.trim() || firstFilledBlock.altText.trim() || firstFilledBlock.src;
  }

  return firstFilledBlock.content.trim();
}

export function toCreateTemplateInput(
  draft: CommunicationTemplateDraft
): CreateCommunicationTemplateInput {
  return {
    templateKey: normalizeTemplateKey(draft.templateKey || draft.name),
    name: draft.name.trim(),
    audience: draft.audience,
    subjectTemplate: draft.subjectTemplate.trim(),
    bodyTemplate: serializeTemplateBody(draft.bodyBlocks),
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
    bodyTemplate: serializeTemplateBody(draft.bodyBlocks),
    isActive: draft.isActive,
  };
}

export function renderTemplateText(value: string): string {
  return value.replace(
    mergeFieldPattern,
    (_match, field: string) => previewContext[field] ?? `{{${field}}}`
  );
}

export function renderTemplateBlocksPreview(
  blocks: CommunicationTemplateBlock[]
): CommunicationTemplateBlock[] {
  return blocks.map((block) => {
    if (block.type === 'image') {
      return {
        ...block,
        src: renderTemplateText(block.src),
        altText: renderTemplateText(block.altText),
        caption: renderTemplateText(block.caption),
      };
    }

    return {
      ...block,
      content: renderTemplateText(block.content),
    };
  });
}

export function insertMergeFieldIntoDraft(
  draft: CommunicationTemplateDraft,
  focusTarget: CommunicationTemplateFocusTarget,
  field: string
): CommunicationTemplateDraft {
  const token = `{{${field}}}`;
  if (focusTarget.kind === 'subject') {
    return {
      ...draft,
      subjectTemplate: draft.subjectTemplate
        ? `${draft.subjectTemplate} ${token}`
        : token,
    };
  }

  if (!focusTarget.blockId || !focusTarget.field) {
    return draft;
  }

  const targetField = focusTarget.field;

  return {
    ...draft,
    bodyBlocks: draft.bodyBlocks.map((block) => {
      if (block.id !== focusTarget.blockId) {
        return block;
      }

      if (block.type === 'image') {
        if (targetField === 'content') {
          return block;
        }
        const currentValue = block[targetField] ?? '';
        return {
          ...block,
          [targetField]: currentValue ? `${currentValue} ${token}` : token,
        };
      }

      if (targetField !== 'content') {
        return block;
      }

      return {
        ...block,
        content: block.content ? `${block.content} ${token}` : token,
      };
    }),
  };
}

function serializeTemplateBody(blocks: CommunicationTemplateBlock[]): string {
  const sanitizedBlocks = blocks
    .map(sanitizeTemplateBlock)
    .filter((block): block is CommunicationTemplateBlock => block !== null);
  return `${templateBlocksPrefix}${JSON.stringify({ version: 1, blocks: sanitizedBlocks })}`;
}

function parseTemplateBody(bodyTemplate: string): CommunicationTemplateBlock[] {
  const trimmedBody = bodyTemplate.trim();
  if (!trimmedBody) {
    return [createTemplateBlock('text')];
  }

  if (trimmedBody.startsWith(templateBlocksPrefix)) {
    const parsedValue = parseTemplateEnvelope(trimmedBody.slice(templateBlocksPrefix.length));
    if (parsedValue.length > 0) {
      return parsedValue;
    }
  }

  return [
    {
      id: createTemplateBlockId(),
      type: 'text',
      content: bodyTemplate,
    },
  ];
}

function parseTemplateEnvelope(serializedValue: string): CommunicationTemplateBlock[] {
  try {
    const parsed = JSON.parse(serializedValue) as {
      version?: number;
      blocks?: unknown[];
    };

    if (parsed.version !== 1 || !Array.isArray(parsed.blocks)) {
      return [];
    }

    return parsed.blocks
      .map(deserializeTemplateBlock)
      .filter((block): block is CommunicationTemplateBlock => block !== null);
  } catch {
    return [];
  }
}

function deserializeTemplateBlock(rawValue: unknown): CommunicationTemplateBlock | null {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const rawBlock = rawValue as Record<string, unknown>;
  const type = rawBlock.type;
  if (type === 'heading' || type === 'text') {
    return {
      id: typeof rawBlock.id === 'string' ? rawBlock.id : createTemplateBlockId(),
      type,
      content: String(rawBlock.content ?? ''),
    };
  }

  if (type === 'image') {
    return {
      id: typeof rawBlock.id === 'string' ? rawBlock.id : createTemplateBlockId(),
      type,
      src: String(rawBlock.src ?? ''),
      altText: String(rawBlock.altText ?? ''),
      caption: String(rawBlock.caption ?? ''),
    };
  }

  return null;
}

function sanitizeTemplateBlock(
  block: CommunicationTemplateBlock
): CommunicationTemplateBlock | null {
  if (block.type === 'image') {
    if (!block.src.trim() && !block.altText.trim() && !block.caption.trim()) {
      return null;
    }

    return {
      ...block,
      src: block.src.trim(),
      altText: block.altText.trim(),
      caption: block.caption.trim(),
    };
  }

  if (!block.content.trim()) {
    return null;
  }

  return {
    ...block,
    content: block.content.trim(),
  };
}

function createTemplateBlockId(): string {
  return `block-${Math.random().toString(36).slice(2, 10)}`;
}
