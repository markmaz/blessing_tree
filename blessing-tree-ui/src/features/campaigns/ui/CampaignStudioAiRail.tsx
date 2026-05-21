import { useEffect, useRef, useState } from 'react';
import { draftCampaignStudioAi } from '@/features/campaigns/api/campaignStudioAiApi';
import {
  addCampaignTeamMember,
  createCampaignMember,
  createCampaignTeam,
  createCampaignTeamRole,
} from '@/features/campaigns/api/campaignTeamWorkspaceApi';
import { type CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import {
  getAiPromptPlaceholder,
  getAiPromptStarters,
  getAiReadinessSignals,
  getAiSuggestionHeading,
  getAiTeamGlossary,
} from '@/features/campaigns/model/campaignStudioAi';
import {
  isAssignMemberToTeamAction,
  isCreateMemberAction,
  isCreateCommunicationTemplateAction,
  isCreateCampaignEventAction,
  isCreateCommunicationScheduleAction,
  isCreateMilestoneAction,
  isCreateTeamAction,
  isCreateTeamRoleAction,
  isUpdateCampaignSettingsAction,
  type CampaignStudioAiAction,
  type CampaignStudioAiDraftResponse,
  type ScheduleAiDraftType,
} from '@/features/campaigns/model/campaignStudioAiDraft';
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
      result = await applyDraftAction(action, {
        createdTemplateRefs: new Map(),
        createdTeamRefs: new Map(),
        createdRoleRefs: new Map(),
        createdMemberRefs: new Map(),
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
    const createdRefs = {
      createdTemplateRefs: new Map<string, string>(),
      createdTeamRefs: new Map<string, string>(),
      createdRoleRefs: new Map<string, string>(),
      createdMemberRefs: new Map<string, string>(),
    };
    let appliedCount = 0;
    let failed = false;

    for (const action of draftResponse.actions) {
      if (action.status === 'blocked') {
        failed = true;
        continue;
      }

      let result;
      try {
        result = await applyDraftAction(action, createdRefs);
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

  const applyDraftAction = async (
    action: CampaignStudioAiAction,
    createdRefs: {
      createdTemplateRefs: Map<string, string>;
      createdTeamRefs: Map<string, string>;
      createdRoleRefs: Map<string, string>;
      createdMemberRefs: Map<string, string>;
    }
  ): Promise<{ success: boolean; templateId?: string }> => {
    if (isCreateCommunicationTemplateAction(action)) {
      const createdTemplate = await onCreateCommunicationTemplate({
        templateKey: action.payload.templateKey,
        name: action.payload.name,
        audience: action.payload.audience,
        subjectTemplate: action.payload.subjectTemplate,
        bodyTemplate: action.payload.bodyTemplate,
        isActive: action.payload.isActive,
      });
      if (!createdTemplate) {
        return { success: false };
      }

      if (action.payload.templateRef) {
        createdRefs.createdTemplateRefs.set(action.payload.templateRef, createdTemplate.id);
      }
      return { success: true, templateId: createdTemplate.id };
    }

    if (isCreateTeamAction(action)) {
      const createdTeam = await createCampaignTeam(campaign.id, {
        name: action.payload.name,
        description: action.payload.description ?? null,
        isActive: action.payload.isActive,
      });
      if (action.payload.teamRef) {
        createdRefs.createdTeamRefs.set(action.payload.teamRef, createdTeam.id);
      }
      await onTeamWorkspaceChanged();
      return { success: true };
    }

    if (isCreateTeamRoleAction(action)) {
      const teamId =
        action.payload.teamId ??
        (action.payload.teamRef
          ? createdRefs.createdTeamRefs.get(action.payload.teamRef) ?? null
          : null);
      if (!teamId) {
        setDraftError('Apply the team draft first so this team role can be created.');
        return { success: false };
      }

      const createdRole = await createCampaignTeamRole(campaign.id, teamId, {
        name: action.payload.name,
        description: action.payload.description ?? null,
        sortOrder: action.payload.sortOrder ?? 0,
        isActive: action.payload.isActive,
      });
      if (action.payload.roleRef) {
        createdRefs.createdRoleRefs.set(action.payload.roleRef, createdRole.id);
      }
      await onTeamWorkspaceChanged();
      return { success: true };
    }

    if (isCreateMemberAction(action)) {
      const createdMember = await createCampaignMember(campaign.id, {
        displayName: action.payload.displayName,
        email: action.payload.email ?? null,
        phone: action.payload.phone ?? null,
        notes: action.payload.notes ?? null,
        memberType: action.payload.memberType,
        appAccessStatus: action.payload.appAccessStatus,
        isActive: action.payload.isActive,
      });
      if (action.payload.memberRef) {
        createdRefs.createdMemberRefs.set(action.payload.memberRef, createdMember.id);
      }
      await onTeamWorkspaceChanged();
      return { success: true };
    }

    if (isAssignMemberToTeamAction(action)) {
      const teamId =
        action.payload.teamId ??
        (action.payload.teamRef
          ? createdRefs.createdTeamRefs.get(action.payload.teamRef) ?? null
          : null);
      const memberId =
        action.payload.memberId ??
        (action.payload.memberRef
          ? createdRefs.createdMemberRefs.get(action.payload.memberRef) ?? null
          : null);
      const teamRoleId =
        action.payload.teamRoleId ??
        (action.payload.teamRoleRef
          ? createdRefs.createdRoleRefs.get(action.payload.teamRoleRef) ?? null
          : null);
      if (!teamId || !memberId) {
        setDraftError('Apply the team and member drafts first so this assignment can be created.');
        return { success: false };
      }

      await addCampaignTeamMember(campaign.id, teamId, memberId, teamRoleId ?? null);
      await onTeamWorkspaceChanged();
      return { success: true };
    }

    if (isUpdateCampaignSettingsAction(action)) {
      return { success: await onUpdateCampaignSettings(action.payload) };
    }

    if (isCreateCampaignEventAction(action)) {
      return { success: await onCreateScheduleEvent(action.payload) };
    }

    if (isCreateCommunicationScheduleAction(action)) {
      const templateId =
        action.payload.templateId ??
        (action.payload.templateRef
          ? createdRefs.createdTemplateRefs.get(action.payload.templateRef) ?? null
          : null);
      if (!templateId) {
        setDraftError('Apply the template draft first so this communication can be placed.');
        return { success: false };
      }

      return {
        success: await onCreateCommunicationSchedule({
          templateId,
          milestoneKey: action.payload.milestoneKey ?? null,
          scheduledFor: action.payload.scheduledFor ?? null,
          status: action.payload.status,
          notes: action.payload.notes ?? null,
        }),
      };
    }

    if (isCreateMilestoneAction(action)) {
      const nextMilestones = milestones
        .filter((milestone) => milestone.milestoneKey !== action.payload.milestoneKey)
        .map((milestone) => ({
          milestoneKey: milestone.milestoneKey,
          label: milestone.label,
          occursOn: milestone.occursOn ?? '',
          notes: milestone.notes ?? null,
          sortOrder: milestone.sortOrder,
        }));
      nextMilestones.push({
        ...action.payload,
        notes: action.payload.notes ?? null,
      });
      nextMilestones.sort((left, right) => left.sortOrder - right.sortOrder);
      return { success: await onSaveMilestones(nextMilestones) };
    }

    return { success: false };
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
