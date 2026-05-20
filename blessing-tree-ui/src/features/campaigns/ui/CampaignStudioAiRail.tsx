import { useMemo, useState } from 'react';
import { type CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import {
  buildScheduleAiDraft,
  type ScheduleAiDraftType,
} from '@/features/campaigns/model/campaignStudioAiDraft';
import {
  getAiPromptStarters,
  getAiReadinessSignals,
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
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';

interface CampaignStudioAiRailProps {
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
  const promptStarters = getAiPromptStarters(selectedSection, readiness, scheduleItems);
  const readinessSignals = getAiReadinessSignals(selectedSection, readiness);
  const scheduleSummary = useMemo(
    () => ({
      hasTemplates: templates.length > 0,
      nextMilestone: milestones.find((milestone) => milestone.occursOn) ?? null,
    }),
    [milestones, templates]
  );

  const handleDraft = () => {
    try {
      const nextDraft = buildScheduleAiDraft({
        prompt: draftPrompt,
        requestedType: draftType,
        milestones,
        templates,
      });
      setDraftPreview(nextDraft);
      setDraftError(null);
      setDraftMessage(null);
    } catch (error) {
      setDraftPreview(null);
      setDraftError(error instanceof Error ? error.message : 'Unable to draft a calendar change.');
      setDraftMessage(null);
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
      setDraftPrompt('');
    }
  };

  return (
    <aside className="campaign-studio__ai-rail" aria-label="Campaign Studio AI builder">
      <div className="campaign-studio__eyebrow">AI Builder</div>
      <h2 className="h5 mb-2">Shape {campaign.name}</h2>
      <p className="text-muted small mb-4">
        {selectedSection === 'schedule'
          ? 'Draft and apply new calendar items directly from a prompt.'
          : `Draft structured changes for the ${selectedSection} section.`}
      </p>

      {selectedSection === 'schedule' ? (
        <>
          <div className="campaign-studio__ai-inline-stats">
            <div className="campaign-studio__inline-note">
              <div className="fw-semibold small mb-1">Calendar Context</div>
              <div className="small text-muted">
                {scheduleSummary.hasTemplates
                  ? `${templates.length} templates available for scheduling.`
                  : 'No communication templates yet.'}
              </div>
              <div className="small text-muted">
                {scheduleSummary.nextMilestone
                  ? `Next milestone: ${scheduleSummary.nextMilestone.label} on ${scheduleSummary.nextMilestone.occursOn}`
                  : 'No milestone dates have been placed yet.'}
              </div>
            </div>
          </div>

          <label className="form-label small fw-semibold">AI Draft Type</label>
          <div className="campaign-studio__ai-draft-switch mb-2" role="tablist" aria-label="AI draft type">
            {scheduleDraftTypeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`campaign-studio__ai-draft-button ${
                  draftType === option.id ? 'is-selected' : ''
                }`}
                onClick={() => setDraftType(option.id)}
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

      <label className="form-label small fw-semibold" htmlFor="campaign-studio-prompt">
        Campaign Prompt
      </label>
      <textarea
        id="campaign-studio-prompt"
        className="form-control mb-3"
        rows={6}
        value={draftPrompt}
        onChange={(event) => setDraftPrompt(event.target.value)}
        placeholder="Describe what you want to add or improve in this campaign."
      />

      <div className="d-grid gap-2 mb-4">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={selectedSection !== 'schedule' || isSaving}
          onClick={handleDraft}
        >
          Draft Calendar Change
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={!draftPreview || isSaving}
          onClick={handleApply}
        >
          Apply Draft
        </button>
      </div>

      {draftError ? (
        <div className="alert alert-warning py-2 small" role="alert">
          {draftError}
        </div>
      ) : null}
      {draftMessage ? (
        <AutoDismissAlert
          key={draftMessage}
          message={draftMessage}
          onDismiss={() => setDraftMessage(null)}
          className="py-2 small"
          showDismissButton={false}
        />
      ) : null}

      {draftPreview ? (
        <div className="campaign-studio__suggestions">
          <div className="small fw-semibold mb-2">Draft Preview</div>
          <div className="campaign-studio__inline-note">
            <div className="fw-semibold small mb-1">{draftPreview.summary}</div>
            <div className="small text-muted">
              {draftPreview.type === 'communication'
                ? 'This will create a communication schedule.'
                : draftPreview.type === 'milestone'
                  ? 'This will place or update a milestone date.'
                  : 'This will create a manual calendar event.'}
            </div>
          </div>
        </div>
      ) : null}

      <div className="campaign-studio__suggestions">
        <div className="small fw-semibold mb-2">Prompt Starters</div>
        <div className="d-grid gap-2">
          {promptStarters.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="campaign-studio__prompt-chip"
              onClick={() => setDraftPrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {readinessSignals.length > 0 ? (
        <div className="campaign-studio__suggestions">
          <div className="small fw-semibold mb-2">Current Signals</div>
          <div className="d-grid gap-2">
            {readinessSignals.map((item) => (
              <div key={item.code} className="campaign-studio__inline-note">
                <div className="fw-semibold small mb-1">{item.message}</div>
                <div className="small text-muted">
                  Use the prompt panel to turn this signal into a concrete calendar action.
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
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
