import { startTransition, useEffect, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioCommunications.css';
import {
  createBlankCommunicationTemplateDraft,
  deriveTemplateKey,
  draftFromCommunicationTemplate,
  insertMergeFieldIntoDraft,
  toCreateTemplateInput,
  toUpdateTemplateInput,
  type CommunicationTemplateDraft,
  type CommunicationTemplateFocusTarget,
} from '@/features/campaigns/model/campaignCommunicationTemplateBuilder';
import type {
  CommunicationAudienceOption,
  CommunicationTemplate,
  CreateCommunicationTemplateInput,
  UpdateCommunicationTemplateInput,
  CommunicationTemplateTestEmailResult,
} from '@/features/campaigns/model/campaignStudioTypes';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import { CampaignStudioTemplateLibrary } from '@/features/campaigns/ui/CampaignStudioTemplateLibrary';
import { CampaignStudioTemplateWorkspace } from '@/features/campaigns/ui/CampaignStudioTemplateWorkspace';

interface CampaignStudioCommunicationsSectionProps {
  audienceCatalog: CommunicationAudienceOption[];
  templates: CommunicationTemplate[];
  isSaving: boolean;
  requestedTemplateId?: string | null;
  onConsumeRequestedTemplate?: () => void;
  onCreateTemplate: (
    input: CreateCommunicationTemplateInput
  ) => Promise<CommunicationTemplate | null>;
  onUpdateTemplate: (
    templateId: string,
    input: UpdateCommunicationTemplateInput
  ) => Promise<CommunicationTemplate | null>;
  onDeleteTemplate: (templateId: string) => Promise<boolean>;
  onSendTestEmail?: (
    templateId: string,
    recipientEmail?: string
  ) => Promise<CommunicationTemplateTestEmailResult | null>;
}

export function CampaignStudioCommunicationsSection({
  audienceCatalog,
  templates,
  isSaving,
  requestedTemplateId = null,
  onConsumeRequestedTemplate,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onSendTestEmail,
}: CampaignStudioCommunicationsSectionProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates[0]?.id ?? null
  );
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'metadata' | 'content'>('metadata');
  const [focusedTarget, setFocusedTarget] = useState<CommunicationTemplateFocusTarget>({
    kind: 'subject',
  });
  const [draft, setDraft] = useState<CommunicationTemplateDraft>(() =>
    templates[0]
      ? draftFromCommunicationTemplate(templates[0])
      : createBlankCommunicationTemplateDraft()
  );

  useEffect(() => {
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (selectedTemplateId && !selectedTemplate) {
      const nextTemplate = templates[0] ?? null;
      startTransition(() => {
        setSelectedTemplateId(nextTemplate?.id ?? null);
        setActiveTab(nextTemplate ? 'metadata' : 'content');
        setDraft(
          nextTemplate
            ? draftFromCommunicationTemplate(nextTemplate)
            : createBlankCommunicationTemplateDraft()
        );
      });
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!requestedTemplateId) {
      return;
    }

    const requestedTemplate = templates.find((template) => template.id === requestedTemplateId);
    if (!requestedTemplate) {
      return;
    }

    startTransition(() => {
      setSelectedTemplateId(requestedTemplate.id);
      setDraft(draftFromCommunicationTemplate(requestedTemplate));
      setActiveTab('metadata');
      onConsumeRequestedTemplate?.();
    });
  }, [onConsumeRequestedTemplate, requestedTemplateId, templates]);

  const handleCreateNew = () => {
    setSelectedTemplateId(null);
    setActiveTab('metadata');
    setIsLibraryCollapsed(true);
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
    setDraft((currentDraft) =>
      insertMergeFieldIntoDraft(currentDraft, focusedTarget, field)
    );
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
            isPanelOpen={!isLibraryCollapsed}
            onSelectTemplate={(templateId) => {
              const selectedTemplate = templates.find((template) => template.id === templateId);
              setSelectedTemplateId(templateId);
              setActiveTab('metadata');
              setIsLibraryCollapsed(false);
              if (selectedTemplate) {
                setDraft(draftFromCommunicationTemplate(selectedTemplate));
              }
            }}
            onCreateNew={handleCreateNew}
            onDeleteTemplate={async (templateId) => {
              const currentIndex = templates.findIndex((template) => template.id === templateId);
              const fallbackTemplate =
                templates[currentIndex + 1] ?? templates[currentIndex - 1] ?? null;

              const deleted = await onDeleteTemplate(templateId);
              if (!deleted) {
                return false;
              }

              if (templateId === selectedTemplateId) {
                setSelectedTemplateId(fallbackTemplate?.id ?? null);
                setDraft(
                  fallbackTemplate
                    ? draftFromCommunicationTemplate(fallbackTemplate)
                    : createBlankCommunicationTemplateDraft()
                );
                setActiveTab(fallbackTemplate ? 'metadata' : 'content');
              }

              return true;
            }}
            onTogglePanel={() => setIsLibraryCollapsed((currentValue) => !currentValue)}
          />

          <CampaignStudioTemplateWorkspace
            draft={draft}
            audienceCatalog={audienceCatalog}
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
            onSendTestEmail={(recipientEmail) =>
              selectedTemplateId && onSendTestEmail
                ? onSendTestEmail(selectedTemplateId, recipientEmail)
                : Promise.resolve(null)
            }
            onInsertMergeField={handleInsertMergeField}
            onFocusTarget={setFocusedTarget}
          />
        </div>
      </CampaignStudioSectionCard>
    </div>
  );
}
