import { useEffect, useRef, useState } from 'react';
import { draftCampaignStudioAi } from '@/features/campaigns/api/campaignStudioAiApi';
import { type CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import {
  getAiPromptPlaceholder,
  getAiPromptStarters,
  getAiReadinessSignals,
  getAiSuggestionHeading,
  getAiTeamGlossary,
} from '@/features/campaigns/model/campaignStudioAi';
import {
  type CampaignStudioAiAction,
  type CampaignStudioAiDraftResponse,
  type ScheduleAiDraftType,
} from '@/features/campaigns/model/campaignStudioAiDraft';
import {
  applyCampaignStudioAiAction,
  createCampaignStudioAiCreatedRefs,
} from '@/features/campaigns/model/campaignStudioAiApply';
import type {
  CampaignMilestone,
  CampaignReadiness,
  CampaignScheduleItem,
  CommunicationTemplate,
  CreateCampaignEventInput,
  CreateCommunicationTemplateInput,
  CreateCommunicationScheduleInput,
  SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';
import type { CampaignUpsertInput } from '@/features/campaigns/model/campaignTypes';
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
  onCreateCommunicationTemplate: (
    input: CreateCommunicationTemplateInput
  ) => Promise<CommunicationTemplate | null>;
  onCreateCommunicationSchedule: (
    input: CreateCommunicationScheduleInput
  ) => Promise<boolean>;
  onSaveMilestones: (milestones: SaveCampaignMilestoneInput[]) => Promise<boolean>;
  onTeamWorkspaceChanged: () => Promise<void>;
  onUpdateCampaignSettings: (input: CampaignUpsertInput) => Promise<boolean>;
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
  onCreateCommunicationTemplate,
  onCreateCommunicationSchedule,
  onSaveMilestones,
  onTeamWorkspaceChanged,
  onUpdateCampaignSettings,
}: CampaignStudioAiRailProps) {
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftType, setDraftType] = useState<ScheduleAiDraftType>('event');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftResponse, setDraftResponse] = useState<CampaignStudioAiDraftResponse | null>(null);
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
  }, [history, pendingPrompt, draftError, draftResponse]);

  useEffect(() => {
    setDraftPrompt('');
    setDraftError(null);
    setDraftMessage(null);
    setDraftResponse(null);
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
      const nextDraft = await draftCampaignStudioAi(campaign.id, {
        section: selectedSection,
        prompt: trimmedPrompt,
        requestedActionType: selectedSection === 'schedule' ? draftType : null,
      });

      setDraftResponse(nextDraft);
      pushAssistantTurn(trimmedPrompt, nextDraft.message);
      setDraftPrompt('');
    } catch (error) {
      setDraftResponse(null);
      setDraftError(error instanceof Error ? error.message : 'Unable to process that AI prompt.');
    } finally {
      setPendingPrompt('');
    }
  };

  const handleApplyAction = async (action: CampaignStudioAiAction) => {
    let result;
    try {
      result = await applyCampaignStudioAiAction(action, createCampaignStudioAiCreatedRefs(), {
        campaignId: campaign.id,
        milestones: milestones.map((milestone) => ({
          milestoneKey: milestone.milestoneKey,
          label: milestone.label,
          occursOn: milestone.occursOn ?? '',
          notes: milestone.notes ?? null,
          sortOrder: milestone.sortOrder,
        })),
        onCreateScheduleEvent,
        onCreateCommunicationTemplate,
        onCreateCommunicationSchedule,
        onSaveMilestones,
        onTeamWorkspaceChanged,
        onUpdateCampaignSettings,
        onDraftError: setDraftError,
      });
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Unable to apply this AI action.');
      return;
    }
    const didSave = result.success;
    if (!didSave) {
      return;
    }

    setDraftMessage(`${action.title} applied to ${campaign.name}.`);
    setDraftError(null);
    setDraftResponse((currentDraft) => {
      if (!currentDraft) {
        return null;
      }

      const nextActions = currentDraft.actions.filter((entry) => entry.id !== action.id);
      if (nextActions.length === 0) {
        return null;
      }

      return {
        ...currentDraft,
        actions: nextActions,
      };
    });
  };

  const handleApplyAll = async () => {
    if (!draftResponse) {
      return;
    }

    const successfulIds = new Set<string>();
    const createdRefs = createCampaignStudioAiCreatedRefs();
    let appliedCount = 0;
    let failed = false;

    for (const action of draftResponse.actions) {
      if (action.status === 'blocked') {
        failed = true;
        continue;
      }

      let result;
      try {
        result = await applyCampaignStudioAiAction(action, createdRefs, {
          campaignId: campaign.id,
          milestones: milestones.map((milestone) => ({
            milestoneKey: milestone.milestoneKey,
            label: milestone.label,
            occursOn: milestone.occursOn ?? '',
            notes: milestone.notes ?? null,
            sortOrder: milestone.sortOrder,
          })),
          onCreateScheduleEvent,
          onCreateCommunicationTemplate,
          onCreateCommunicationSchedule,
          onSaveMilestones,
          onTeamWorkspaceChanged,
          onUpdateCampaignSettings,
          onDraftError: setDraftError,
        });
      } catch (error) {
        setDraftError(error instanceof Error ? error.message : 'Some AI actions could not be applied.');
        failed = true;
        continue;
      }
      if (result.success) {
        successfulIds.add(action.id);
        appliedCount += 1;
      } else {
        failed = true;
      }
    }

    if (appliedCount > 0) {
      setDraftMessage(
        `${appliedCount} AI action${appliedCount === 1 ? '' : 's'} applied to ${campaign.name}.`
      );
      setDraftResponse((currentDraft) => {
        if (!currentDraft) {
          return null;
        }

        const nextActions = currentDraft.actions.filter((action) => !successfulIds.has(action.id));
        if (nextActions.length === 0) {
          return null;
        }

        return {
          ...currentDraft,
          actions: nextActions,
        };
      });
    }

    setDraftError(failed ? 'Some AI actions could not be applied.' : null);
  };

  const handleActionChange = (nextAction: CampaignStudioAiAction) => {
    setDraftResponse((currentDraft) => {
      if (!currentDraft) {
        return null;
      }

      return {
        ...currentDraft,
        actions: currentDraft.actions.map((action) =>
          action.id === nextAction.id ? nextAction : action
        ),
      };
    });
  };

  const clearHistory = () => {
    setHistory([]);
    setCopiedPromptId(null);
    setDraftResponse(null);
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
              : selectedSection === 'communications'
                ? 'Draft templates and place them on the campaign calendar from one prompt.'
                : selectedSection === 'settings'
                  ? 'Draft campaign setting changes and lifecycle moves before you apply them.'
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
          draftResponse={draftResponse}
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
          onApplyAction={(action) => {
            void handleApplyAction(action);
          }}
          onActionChange={handleActionChange}
          onApplyAll={() => {
            void handleApplyAll();
          }}
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
