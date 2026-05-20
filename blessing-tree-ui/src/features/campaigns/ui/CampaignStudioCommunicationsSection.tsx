import { useState } from 'react';
import '@/features/campaigns/ui/campaignStudioCommunications.css';
import {
  createBlankCommunicationTemplateDraft,
  deriveTemplateKey,
  draftFromCommunicationTemplate,
  toCreateTemplateInput,
  toUpdateTemplateInput,
  type CommunicationTemplateDraft,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import type {
  CommunicationTemplate,
  CreateCommunicationTemplateInput,
  UpdateCommunicationTemplateInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import { CampaignStudioTemplateLibrary } from '@/features/campaigns/ui/CampaignStudioTemplateLibrary';
import { CampaignStudioTemplateWorkspace } from '@/features/campaigns/ui/CampaignStudioTemplateWorkspace';

interface CampaignStudioCommunicationsSectionProps {
  templates: CommunicationTemplate[];
  isSaving: boolean;
  onCreateTemplate: (
    input: CreateCommunicationTemplateInput
  ) => Promise<CommunicationTemplate | null>;
  onUpdateTemplate: (
    templateId: string,
    input: UpdateCommunicationTemplateInput
  ) => Promise<CommunicationTemplate | null>;
}

export function CampaignStudioCommunicationsSection({
  templates,
  isSaving,
  onCreateTemplate,
  onUpdateTemplate,
}: CampaignStudioCommunicationsSectionProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<'metadata' | 'content'>('metadata');
  const [focusedField, setFocusedField] = useState<'subjectTemplate' | 'bodyTemplate'>(
    'bodyTemplate'
  );
  const [draft, setDraft] = useState<CommunicationTemplateDraft>(() =>
    templates[0]
      ? draftFromCommunicationTemplate(templates[0])
      : createBlankCommunicationTemplateDraft()
  );

  const handleCreateNew = () => {
    setSelectedTemplateId(null);
    setActiveTab('metadata');
    setDraft(createBlankCommunicationTemplateDraft());
  };

  const handleSave = async () => {
    const savedTemplate = selectedTemplateId
      ? await onUpdateTemplate(selectedTemplateId, toUpdateTemplateInput(draft))
      : await onCreateTemplate(toCreateTemplateInput(draft));

    if (!savedTemplate) {
      return;
    }

    setSelectedTemplateId(savedTemplate.id);
    setDraft(draftFromCommunicationTemplate(savedTemplate));
    setActiveTab('content');
  };

  const handleInsertMergeField = (field: string) => {
    const token = `{{${field}}}`;
    setDraft((currentDraft) => ({
      ...currentDraft,
      [focusedField]: currentDraft[focusedField]
        ? `${currentDraft[focusedField]} ${token}`
        : token,
    }));
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Communications"
        title="Email Template Builder"
        description="Build reusable campaign email templates here. Communication timing now lives only in the campaign calendar and scheduler."
      >
        <div className="campaign-template-builder">
          <CampaignStudioTemplateLibrary
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={(templateId) => {
              setSelectedTemplateId(templateId);
              setActiveTab('metadata');
            }}
            onCreateNew={handleCreateNew}
          />

          <CampaignStudioTemplateWorkspace
            draft={draft}
            activeTab={activeTab}
            isSaving={isSaving}
            isExisting={selectedTemplateId !== null}
            onChangeTab={setActiveTab}
            onChangeDraft={(updater) =>
              setDraft((currentDraft) => {
                const nextDraft = updater(currentDraft);
                const currentDerivedKey = deriveTemplateKey(currentDraft.name);
                const shouldAutoDeriveKey =
                  !selectedTemplateId &&
                  nextDraft.name &&
                  (
                    !currentDraft.templateKey.trim() ||
                    currentDraft.templateKey.trim() === currentDerivedKey
                  );

                if (shouldAutoDeriveKey) {
                  return {
                    ...nextDraft,
                    templateKey: deriveTemplateKey(nextDraft.name),
                  };
                }
                return nextDraft;
              })
            }
            onSave={handleSave}
            onInsertMergeField={handleInsertMergeField}
            onFocusField={setFocusedField}
          />
        </div>
      </CampaignStudioSectionCard>
    </div>
  );
}
