import type { RefObject } from 'react';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import { type CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import {
  type CampaignStudioAiAction,
  type CampaignStudioAiDraftResponse,
  type ScheduleAiDraftType,
} from '@/features/campaigns/model/campaignStudioAiDraft';
import type {
  CampaignMilestone,
  CampaignReadiness,
  CommunicationTemplate,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';

export interface CampaignAiTurn {
  id: string;
  prompt: string;
  responseMessage: string;
}

interface CampaignStudioAiThreadProps {
  selectedSection: CampaignStudioSectionId;
  templates: CommunicationTemplate[];
  milestones: CampaignMilestone[];
  promptStarters: string[];
  suggestionHeading: string;
  readinessSignals: CampaignReadiness['items'];
  teamGlossary: CampaignTeamGlossaryEntry[];
  history: CampaignAiTurn[];
  pendingPrompt: string;
  copiedPromptId: string | null;
  draftError: string | null;
  draftMessage: string | null;
  draftResponse: CampaignStudioAiDraftResponse | null;
  isSaving: boolean;
  draftType: ScheduleAiDraftType;
  onDraftTypeChange: (draftType: ScheduleAiDraftType) => void;
  onSelectPromptStarter: (prompt: string) => void;
  onCopyPrompt: (prompt: string, turnId: string) => void;
  onDismissDraftMessage: () => void;
  onApplyAction: (action: CampaignStudioAiAction) => void;
  onApplyAll: () => void;
  threadRef: RefObject<HTMLDivElement | null>;
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

export function CampaignStudioAiThread({
  selectedSection,
  templates,
  milestones,
  promptStarters,
  suggestionHeading,
  readinessSignals,
  teamGlossary,
  history,
  pendingPrompt,
  copiedPromptId,
  draftError,
  draftMessage,
  draftResponse,
  isSaving,
  draftType,
  onDraftTypeChange,
  onSelectPromptStarter,
  onCopyPrompt,
  onDismissDraftMessage,
  onApplyAction,
  onApplyAll,
  threadRef,
}: CampaignStudioAiThreadProps) {
  const hasTemplates = templates.length > 0;
  const nextMilestone = milestones.find((milestone) => milestone.occursOn) ?? null;

  return (
    <div className="campaign-studio__ai-thread" aria-live="polite" ref={threadRef}>
      {!history.length && !pendingPrompt ? (
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
              <label className="form-label small fw-semibold mb-2">AI Draft Type</label>
              <div
                className="campaign-studio__ai-draft-switch mb-2"
                role="tablist"
                aria-label="AI draft type"
              >
                {scheduleDraftTypeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`campaign-studio__ai-draft-button ${
                      draftType === option.id ? 'is-selected' : ''
                    }`}
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

          <section className="campaign-studio__ai-suggestions" aria-label="Campaign prompt suggestions">
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
                      Use Campaign AI to turn this into a concrete next step.
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {history.map((entry) => (
        <article key={entry.id} className="campaign-studio__ai-turn">
          <div className="campaign-studio__ai-bubble campaign-studio__ai-bubble-user">
            <div className="campaign-studio__ai-bubble-label">You</div>
            <div className="campaign-studio__ai-bubble-text">{entry.prompt}</div>
            <button
              type="button"
              className="btn btn-sm campaign-studio__ai-copy-btn"
              onClick={() => onCopyPrompt(entry.prompt, entry.id)}
              aria-label={copiedPromptId === entry.id ? 'Prompt copied' : 'Copy prompt'}
              title={copiedPromptId === entry.id ? 'Copied' : 'Copy prompt'}
            >
              <i
                className={`bi ${copiedPromptId === entry.id ? 'bi-check-lg' : 'bi-copy'}`}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="campaign-studio__ai-bubble campaign-studio__ai-bubble-assistant">
            <div className="campaign-studio__ai-bubble-label">Campaign AI</div>
            <div className="campaign-studio__ai-bubble-text">{entry.responseMessage}</div>
          </div>
        </article>
      ))}

      {pendingPrompt ? (
        <article className="campaign-studio__ai-turn">
          <div className="campaign-studio__ai-bubble campaign-studio__ai-bubble-user">
            <div className="campaign-studio__ai-bubble-label">You</div>
            <div className="campaign-studio__ai-bubble-text">{pendingPrompt}</div>
          </div>
          <div
            className="campaign-studio__ai-bubble campaign-studio__ai-bubble-assistant campaign-studio__ai-thinking-bubble"
            aria-live="polite"
            aria-label="Thinking"
          >
            <span className="campaign-studio__ai-thinking-word">Thinking</span>
            <span className="campaign-studio__ai-thinking-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        </article>
      ) : null}

      {draftError ? (
        <div className="alert alert-warning py-2 small" role="alert">
          {draftError}
        </div>
      ) : null}

      {draftMessage ? (
        <AutoDismissAlert
          key={draftMessage}
          message={draftMessage}
          onDismiss={onDismissDraftMessage}
          className="py-2 small"
          showDismissButton={false}
        />
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
                <div key={action.id} className="campaign-studio__ai-action-card">
                  <div className="campaign-studio__ai-action-header">
                    <div>
                      <div className="fw-semibold small">{action.title}</div>
                      <div className="small text-muted">{action.summary}</div>
                    </div>
                    <span className="campaign-chip campaign-chip-muted">
                      {action.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  {action.assumptions.length > 0 ? (
                    <ul className="campaign-studio__ai-draft-list">
                      {action.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  ) : null}

                  {action.warnings.length > 0 ? (
                    <ul className="campaign-studio__ai-draft-list">
                      {action.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={isSaving || action.status === 'blocked'}
                    onClick={() => onApplyAction(action)}
                  >
                    <i className="bi bi-check2-square" aria-hidden="true" />
                    <span>Apply</span>
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {draftResponse.actions.length > 1 ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mt-3"
              disabled={isSaving}
              onClick={onApplyAll}
            >
              <i className="bi bi-check2-all" aria-hidden="true" />
              <span>Apply All</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
