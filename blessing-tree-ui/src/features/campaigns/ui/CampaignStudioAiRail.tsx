import { useEffect, useRef, useState } from 'react';
import { askBlessingTree } from '@/features/ask/api/askApi';
import type { AskResponse } from '@/features/ask/model/askTypes';
import { AskResult } from '@/features/ask/ui/AskResult';
import '@/features/ask/ui/ask.css';
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
import { CampaignStudioAiActionCard } from '@/features/campaigns/ui/CampaignStudioAiActionCard';
import { CampaignStudioAiComposer } from '@/features/campaigns/ui/CampaignStudioAiComposer';

interface CampaignAiTurn {
  id: string;
  prompt: string;
  responseMessage?: string;
  askResponse?: AskResponse;
  error?: string;
}

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

const scheduleDraftTypeOptions: Array<{
  id: ScheduleAiDraftType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'event',
    label: 'Event',
    description: 'Volunteer days, sorting blocks, pickup staffing, and other manual work.',
    icon: 'bi-calendar-plus',
  },
  {
    id: 'milestone',
    label: 'Milestone',
    description: 'Named checkpoints like registration opening or pickup weekend.',
    icon: 'bi-signpost-2',
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Emails and reminders using one of the campaign templates.',
    icon: 'bi-envelope-paper',
  },
];

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

  const pushAskTurn = (prompt: string, askResponse: AskResponse) => {
    setHistory((currentHistory) => [
      ...currentHistory,
      {
        id: `${Date.now()}-${currentHistory.length}`,
        prompt,
        askResponse,
      },
    ]);
  };

  const pushErrorTurn = (prompt: string, errorMessage: string) => {
    setHistory((currentHistory) => [
      ...currentHistory,
      {
        id: `${Date.now()}-${currentHistory.length}`,
        prompt,
        error: errorMessage,
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
      if (shouldUseStudioDraft(trimmedPrompt)) {
        const nextDraft = await draftCampaignStudioAi(campaign.id, {
          section: selectedSection,
          prompt: trimmedPrompt,
          requestedActionType: selectedSection === 'schedule' ? draftType : null,
        });

        setDraftResponse(nextDraft);
        pushAssistantTurn(trimmedPrompt, nextDraft.message);
      } else {
        const askResponse = await askBlessingTree(campaign.id, trimmedPrompt, {
          screen: `Campaign Studio ${selectedSection}`,
          route: 'campaign_studio',
        });
        setDraftResponse(null);
        pushAskTurn(trimmedPrompt, askResponse);
      }
      setDraftPrompt('');
    } catch (error) {
      setDraftResponse(null);
      const errorMessage = error instanceof Error ? error.message : 'Unable to process that AI prompt.';
      setDraftError(errorMessage);
      pushErrorTurn(trimmedPrompt, errorMessage);
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
    setDraftResponse(null);
    setDraftError(null);
  };

  const startNewSession = () => {
    clearHistory();
    setDraftPrompt('');
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
            <span>Ask</span> <span className="campaign-studio__ai-title-accent">Blessing Tree</span>
          </h2>
          <p className="campaign-studio__ai-context mb-0">
            Ask questions in this Studio context, or draft changes and review them before applying.
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
        <div className="campaign-studio__ai-thread ask-transcript" aria-live="polite" ref={threadRef}>
          {!history.length && !pendingPrompt ? (
            <CampaignStudioAskEmptyState
              selectedSection={selectedSection}
              templates={templates}
              milestones={milestones}
              promptStarters={promptStarters}
              suggestionHeading={suggestionHeading}
              readinessSignals={readinessSignals}
              teamGlossary={teamGlossary}
              draftType={draftType}
              onDraftTypeChange={setDraftType}
              onSelectPromptStarter={(prompt) => {
                setDraftPrompt(prompt);
                promptRef.current?.focus();
              }}
            />
          ) : null}

          {history.map((entry) => (
            <article key={entry.id} className="ask-turn campaign-studio__ask-turn">
              <div className="ask-message ask-message--user">
                <div className="ask-message__bubble">
                  <p className="mb-0">{entry.prompt}</p>
                  <p className="ask-message__context mb-0">
                    Campaign Studio · {selectedSection}
                  </p>
                </div>
              </div>

              <div className="ask-message ask-message--assistant">
                {entry.askResponse ? (
                  <AskResult campaignId={campaign.id} response={entry.askResponse} onPrompt={(prompt) => void handleDraft(prompt)} />
                ) : entry.error ? (
                  <div className="ask-message__bubble ask-message__bubble--error" role="alert">
                    {entry.error}
                  </div>
                ) : entry.responseMessage ? (
                  <div className="ask-message__bubble ask-result">
                    <div className="ask-result__header">
                      <div>
                        <div className="campaign-chip-row mb-2">
                          <span className="campaign-chip campaign-chip-muted">Studio Draft</span>
                        </div>
                        <h2 className="h5 mb-2">Review Draft</h2>
                        <p className="mb-0">{entry.responseMessage}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}

          {pendingPrompt ? (
            <article className="ask-turn campaign-studio__ask-turn">
              <div className="ask-message ask-message--user">
                <div className="ask-message__bubble">
                  <p className="mb-0">{pendingPrompt}</p>
                </div>
              </div>
              <div className="ask-message ask-message--assistant">
                <div className="ask-message__bubble ask-message__bubble--pending">
                  <span className="ask-thinking-dot" aria-hidden="true" />
                  <span>Checking Blessing Tree...</span>
                </div>
              </div>
            </article>
          ) : null}

          {draftError ? (
            <div className="alert alert-warning py-2 small" role="alert">
              {draftError}
            </div>
          ) : null}

          {draftMessage ? (
            <div className="alert alert-success py-2 small" role="status">
              {draftMessage}
            </div>
          ) : null}

          {draftResponse ? (
            <div className="campaign-studio__ai-draft-preview">
              <div className="fw-semibold small mb-1">Draft Preview</div>
              <div className="small text-muted mb-3">{draftResponse.message}</div>

              {draftResponse.assumptions.length > 0 ? (
                <div className="campaign-studio__ai-draft-meta">
                  <div className="fw-semibold small mb-1">Assumptions</div>
                  <ul className="campaign-studio__ai-draft-list">
                    {draftResponse.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {draftResponse.warnings.length > 0 ? (
                <div className="campaign-studio__ai-draft-meta">
                  <div className="fw-semibold small mb-1">Warnings</div>
                  <ul className="campaign-studio__ai-draft-list">
                    {draftResponse.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {draftResponse.actions.length > 0 ? (
                <div className="campaign-studio__ai-action-list">
                  {draftResponse.actions.map((action) => (
                    <CampaignStudioAiActionCard
                      key={action.id}
                      action={action}
                      isSaving={isSaving}
                      onApplyAction={(actionToApply) => void handleApplyAction(actionToApply)}
                      onActionChange={handleActionChange}
                    />
                  ))}
                </div>
              ) : null}

              {draftResponse.actions.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm mt-3"
                  disabled={isSaving}
                  onClick={() => void handleApplyAll()}
                >
                  <i className="bi bi-check2-all" aria-hidden="true" />
                  <span>Apply All</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <CampaignStudioAiComposer
          prompt={draftPrompt}
          placeholder={promptPlaceholder.replace('Campaign AI', 'Ask Blessing Tree')}
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

function CampaignStudioAskEmptyState({
  selectedSection,
  templates,
  milestones,
  promptStarters,
  suggestionHeading,
  readinessSignals,
  teamGlossary,
  draftType,
  onDraftTypeChange,
  onSelectPromptStarter,
}: {
  selectedSection: CampaignStudioSectionId;
  templates: CommunicationTemplate[];
  milestones: CampaignMilestone[];
  promptStarters: string[];
  suggestionHeading: string;
  readinessSignals: CampaignReadiness['items'];
  teamGlossary: ReturnType<typeof getAiTeamGlossary>;
  draftType: ScheduleAiDraftType;
  onDraftTypeChange: (draftType: ScheduleAiDraftType) => void;
  onSelectPromptStarter: (prompt: string) => void;
}) {
  const hasTemplates = templates.length > 0;
  const nextMilestone = milestones.find((milestone) => milestone.occursOn) ?? null;

  return (
    <>
      {selectedSection === 'schedule' ? (
        <div className="campaign-studio__ai-empty-state">
          <div className="small text-muted">
            {hasTemplates
              ? `${templates.length} templates are available for scheduling.`
              : 'No communication templates are ready for scheduling yet.'}{' '}
            {nextMilestone
              ? `Next milestone: ${nextMilestone.label} on ${nextMilestone.occursOn}.`
              : 'No milestone dates have been placed yet.'}
          </div>
        </div>
      ) : null}

      {selectedSection === 'schedule' ? (
        <>
          <label className="form-label small fw-semibold mb-2">Draft Type</label>
          <div className="campaign-studio__ai-draft-switch mb-2" role="tablist" aria-label="AI draft type">
            {scheduleDraftTypeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`campaign-studio__ai-draft-button ${draftType === option.id ? 'is-selected' : ''}`}
                onClick={() => onDraftTypeChange(option.id)}
                aria-pressed={draftType === option.id}
                aria-label={option.label}
                title={option.label}
              >
                <i className={`bi ${option.icon}`} aria-hidden="true" />
                <span className="fw-semibold">{option.label}</span>
              </button>
            ))}
          </div>
          <div className="campaign-studio__ai-draft-description mb-3">
            {scheduleDraftTypeOptions.find((option) => option.id === draftType)?.description}
          </div>
        </>
      ) : null}

      <section className="campaign-studio__ai-suggestions" aria-label="Ask Blessing Tree suggestions">
        <div className="campaign-studio__ai-suggestions-header">
          <div className="campaign-studio__ai-suggestions-title">{suggestionHeading}</div>
        </div>
        <div className="campaign-studio__ai-suggestion-list">
          {promptStarters.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="campaign-studio__ai-suggestion-card"
              onClick={() => onSelectPromptStarter(prompt)}
            >
              <i className="bi bi-chat-square-text" aria-hidden="true" />
              <strong>{prompt}</strong>
              <span>Use this as a starting point in the {selectedSection} workspace.</span>
            </button>
          ))}
        </div>
      </section>

      {teamGlossary.length > 0 ? (
        <section className="campaign-studio__ai-suggestions">
          <div className="campaign-studio__ai-suggestions-header">
            <div className="campaign-studio__ai-suggestions-title">Team Concepts</div>
          </div>
          <div className="campaign-studio__ai-suggestion-list">
            {teamGlossary.map((entry) => (
              <div key={entry.key} className="campaign-studio__inline-note">
                <div className="fw-semibold small mb-1">{entry.label}</div>
                <div className="small text-muted">{entry.description}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {readinessSignals.length > 0 ? (
        <section className="campaign-studio__ai-suggestions">
          <div className="campaign-studio__ai-suggestions-header">
            <div className="campaign-studio__ai-suggestions-title">Current Signals</div>
          </div>
          <div className="campaign-studio__ai-suggestion-list">
            {readinessSignals.map((item) => (
              <div key={item.code} className="campaign-studio__inline-note">
                <div className="fw-semibold small mb-1">{item.message}</div>
                <div className="small text-muted">
                  Ask Blessing Tree to explain this or draft a concrete next step.
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function shouldUseStudioDraft(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  if (/^(how|what|where|when|who|why|which|show|list|tell me|explain|summarize)\b/.test(normalized)) {
    return false;
  }
  return /^(please\s+|can you\s+)?(draft|create|add|schedule|fix|unblock|apply|generate|write|build|set|make)\b/.test(
    normalized
  );
}
