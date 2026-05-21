import { useEffect, useRef, useState } from 'react';
import { type CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import {
  buildScheduleAiDraft,
  type ScheduleAiDraftType,
} from '@/features/campaigns/model/campaignStudioAiDraft';
import {
  buildAiAssistantResponse,
  getAiPromptPlaceholder,
  getAiPromptStarters,
  getAiReadinessSignals,
  getAiSuggestionHeading,
  getAiTeamGlossary,
} from '@/features/campaigns/model/campaignStudioAi';
import type {
  CampaignMilestone,
  CampaignReadiness,
  CampaignScheduleItem,
  CommunicationTemplate,
  CreateCampaignEventInput,
  CreateCommunicationScheduleInput,
  SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';
import {
  CampaignStudioAiThread,
  type CampaignAiTurn,
} from '@/features/campaigns/ui/CampaignStudioAiThread';
import { CampaignStudioAiComposer } from '@/features/campaigns/ui/CampaignStudioAiComposer';

interface CampaignStudioAiRailProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  selectedSection: CampaignStudioSectionId;
  readiness: CampaignReadiness;
  scheduleItems: CampaignScheduleItem[];
  templates: CommunicationTemplate[];
  milestones: CampaignMilestone[];
  isSaving: boolean;
  onCreateScheduleEvent: (input: CreateCampaignEventInput) => Promise<boolean>;
  onCreateCommunicationSchedule: (
    input: CreateCommunicationScheduleInput
  ) => Promise<boolean>;
  onSaveMilestones: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
}

export function CampaignStudioAiRail({
  open,
  onClose,
  campaign,
  selectedSection,
  readiness,
  scheduleItems,
  templates,
  milestones,
  isSaving,
  onCreateScheduleEvent,
  onCreateCommunicationSchedule,
  onSaveMilestones,
}: CampaignStudioAiRailProps) {
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftType, setDraftType] = useState<ScheduleAiDraftType>('event');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftPreview, setDraftPreview] = useState<ReturnType<typeof buildScheduleAiDraft> | null>(
    null
  );
  const [history, setHistory] = useState<CampaignAiTurn[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const promptStarters = getAiPromptStarters(selectedSection, readiness, scheduleItems);
  const readinessSignals = getAiReadinessSignals(selectedSection, readiness);
  const teamGlossary = getAiTeamGlossary(selectedSection);
  const promptPlaceholder = getAiPromptPlaceholder(selectedSection);
  const suggestionHeading = getAiSuggestionHeading(selectedSection);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [history, pendingPrompt, draftError]);

  useEffect(() => {
    setDraftPrompt('');
    setDraftError(null);
    setDraftMessage(null);
    setDraftPreview(null);
    setHistory([]);
    setPendingPrompt('');
    setCopiedPromptId(null);
  }, [selectedSection, campaign.id]);

  const pushAssistantTurn = (prompt: string, responseMessage: string) => {
    setHistory((currentHistory) => [
      ...currentHistory,
      {
        id: `${Date.now()}-${currentHistory.length}`,
        prompt,
        responseMessage,
      },
    ]);
  };

  const handleDraft = async (nextPrompt = draftPrompt) => {
    const trimmedPrompt = nextPrompt.trim();
    if (!trimmedPrompt || isSaving) {
      return;
    }

    setPendingPrompt(trimmedPrompt);
    setDraftError(null);
    setDraftMessage(null);

    try {
      if (selectedSection === 'schedule') {
        const nextDraft = buildScheduleAiDraft({
          prompt: trimmedPrompt,
          requestedType: draftType,
          milestones,
          templates,
        });

        setDraftPreview(nextDraft);
        pushAssistantTurn(
          trimmedPrompt,
          buildAiAssistantResponse({
            campaign,
            selectedSection,
            prompt: trimmedPrompt,
            readiness,
            scheduleItems,
            templates,
            milestones,
            draftSummary: nextDraft.summary,
          })
        );
      } else {
        setDraftPreview(null);
        pushAssistantTurn(
          trimmedPrompt,
          buildAiAssistantResponse({
            campaign,
            selectedSection,
            prompt: trimmedPrompt,
            readiness,
            scheduleItems,
            templates,
            milestones,
          })
        );
      }

      setDraftPrompt('');
    } catch (error) {
      setDraftPreview(null);
      setDraftError(error instanceof Error ? error.message : 'Unable to process that AI prompt.');
    } finally {
      setPendingPrompt('');
    }
  };

  const handleApply = async () => {
    if (!draftPreview) {
      return;
    }

    let didSave = false;
    if (draftPreview.eventInput) {
      didSave = await onCreateScheduleEvent(draftPreview.eventInput);
    } else if (draftPreview.communicationInput) {
      didSave = await onCreateCommunicationSchedule(draftPreview.communicationInput);
    } else if (draftPreview.milestoneInput) {
      const nextMilestones: SaveCampaignMilestoneInput[] = milestones
        .filter((milestone) => milestone.milestoneKey !== draftPreview.milestoneInput?.milestoneKey)
        .map((milestone) => ({
          milestoneKey: milestone.milestoneKey,
          label: milestone.label,
          occursOn: milestone.occursOn ?? '',
          notes: milestone.notes ?? null,
          sortOrder: milestone.sortOrder,
        }));
      nextMilestones.push(draftPreview.milestoneInput);
      nextMilestones.sort((left, right) => left.sortOrder - right.sortOrder);
      didSave = await onSaveMilestones(nextMilestones);
    }

    if (didSave) {
      setDraftMessage(`${draftPreview.summary} added to ${campaign.name}.`);
      setDraftError(null);
      setDraftPreview(null);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setCopiedPromptId(null);
    setDraftPreview(null);
    setDraftError(null);
  };

  const startNewSession = () => {
    clearHistory();
    setDraftPrompt('');
  };

  const copyPrompt = async (value: string, turnId: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedPromptId(turnId);
      window.setTimeout(() => setCopiedPromptId(null), 1200);
    } catch {
      setCopiedPromptId(null);
    }
  };

  return (
    <aside
      className={`campaign-studio__ai-rail ${open ? 'is-open' : 'is-closed'}`}
      aria-label="Campaign Studio AI builder"
      aria-hidden={!open}
    >
      <div className="campaign-studio__ai-rail-header">
        <div className="campaign-studio__ai-brand">
          <h2 className="campaign-studio__ai-title">
            <span>Campaign</span> <span className="campaign-studio__ai-title-accent">AI</span>
          </h2>
          <p className="campaign-studio__ai-context mb-0">
            {selectedSection === 'schedule'
              ? 'Draft and apply campaign calendar updates from one prompt.'
              : `Focus the ${selectedSection} workspace with guided prompts and quick explanations.`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm campaign-studio__ai-close-btn"
          aria-label="Close AI panel"
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <div className="campaign-studio__ai-panel-body">
        <CampaignStudioAiThread
          selectedSection={selectedSection}
          templates={templates}
          milestones={milestones}
          promptStarters={promptStarters}
          suggestionHeading={suggestionHeading}
          readinessSignals={readinessSignals}
          teamGlossary={teamGlossary}
          history={history}
          pendingPrompt={pendingPrompt}
          copiedPromptId={copiedPromptId}
          draftError={draftError}
          draftMessage={draftMessage}
          draftPreview={draftPreview}
          isSaving={isSaving}
          draftType={draftType}
          onDraftTypeChange={setDraftType}
          onSelectPromptStarter={(prompt) => {
            setDraftPrompt(prompt);
            promptRef.current?.focus();
          }}
          onCopyPrompt={(prompt, turnId) => {
            void copyPrompt(prompt, turnId);
          }}
          onDismissDraftMessage={() => setDraftMessage(null)}
          onApplyDraft={handleApply}
          threadRef={threadRef}
        />

        <CampaignStudioAiComposer
          prompt={draftPrompt}
          placeholder={promptPlaceholder}
          isSaving={isSaving}
          isPending={Boolean(pendingPrompt)}
          canClearHistory={history.length > 0}
          promptRef={promptRef}
          onPromptChange={setDraftPrompt}
          onSubmit={() => {
            void handleDraft();
          }}
          onClearHistory={clearHistory}
          onStartNewSession={startNewSession}
        />
      </div>
    </aside>
  );
}
