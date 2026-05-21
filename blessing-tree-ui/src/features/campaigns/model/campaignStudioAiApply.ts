import {
  addCampaignTeamMember,
  createCampaignMember,
  createCampaignTeam,
  createCampaignTeamRole,
} from '@/features/campaigns/api/campaignTeamWorkspaceApi';
import {
  isAssignMemberToTeamAction,
  isCreateMemberAction,
  isCreateCommunicationTemplateAction,
  isCreateCampaignEventAction,
  isCreateCommunicationScheduleAction,
  isCreateMilestoneAction,
  isCreateTeamAction,
  isCreateTeamRoleAction,
  isSuggestStatusChangeAction,
  isUpdateCampaignSettingsAction,
  type CampaignStudioAiAction,
} from '@/features/campaigns/model/campaignStudioAiDraft';
import type {
  CreateCampaignEventInput,
  CreateCommunicationTemplateInput,
  CreateCommunicationScheduleInput,
  SaveCampaignMilestoneInput,
  CommunicationTemplate,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignUpsertInput } from '@/features/campaigns/model/campaignTypes';

export interface CampaignStudioAiCreatedRefs {
  createdTemplateRefs: Map<string, string>;
  createdTeamRefs: Map<string, string>;
  createdRoleRefs: Map<string, string>;
  createdMemberRefs: Map<string, string>;
}

export interface CampaignStudioAiApplyHandlers {
  campaignId: string;
  milestones: SaveCampaignMilestoneInput[];
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
  onDraftError: (message: string) => void;
}

export function createCampaignStudioAiCreatedRefs(): CampaignStudioAiCreatedRefs {
  return {
    createdTemplateRefs: new Map<string, string>(),
    createdTeamRefs: new Map<string, string>(),
    createdRoleRefs: new Map<string, string>(),
    createdMemberRefs: new Map<string, string>(),
  };
}

export async function applyCampaignStudioAiAction(
  action: CampaignStudioAiAction,
  createdRefs: CampaignStudioAiCreatedRefs,
  handlers: CampaignStudioAiApplyHandlers
): Promise<{ success: boolean; templateId?: string }> {
  if (isCreateCommunicationTemplateAction(action)) {
    const createdTemplate = await handlers.onCreateCommunicationTemplate({
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
    const createdTeam = await createCampaignTeam(handlers.campaignId, {
      name: action.payload.name,
      description: action.payload.description ?? null,
      isActive: action.payload.isActive,
    });
    if (action.payload.teamRef) {
      createdRefs.createdTeamRefs.set(action.payload.teamRef, createdTeam.id);
    }
    await handlers.onTeamWorkspaceChanged();
    return { success: true };
  }

  if (isCreateTeamRoleAction(action)) {
    const teamId =
      action.payload.teamId ??
      (action.payload.teamRef
        ? createdRefs.createdTeamRefs.get(action.payload.teamRef) ?? null
        : null);
    if (!teamId) {
      handlers.onDraftError('Apply the team draft first so this team role can be created.');
      return { success: false };
    }

    const createdRole = await createCampaignTeamRole(handlers.campaignId, teamId, {
      name: action.payload.name,
      description: action.payload.description ?? null,
      sortOrder: action.payload.sortOrder ?? 0,
      isActive: action.payload.isActive,
    });
    if (action.payload.roleRef) {
      createdRefs.createdRoleRefs.set(action.payload.roleRef, createdRole.id);
    }
    await handlers.onTeamWorkspaceChanged();
    return { success: true };
  }

  if (isCreateMemberAction(action)) {
    const createdMember = await createCampaignMember(handlers.campaignId, {
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
    await handlers.onTeamWorkspaceChanged();
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
      handlers.onDraftError(
        'Apply the team and member drafts first so this assignment can be created.'
      );
      return { success: false };
    }

    await addCampaignTeamMember(handlers.campaignId, teamId, memberId, teamRoleId ?? null);
    await handlers.onTeamWorkspaceChanged();
    return { success: true };
  }

  if (isUpdateCampaignSettingsAction(action) || isSuggestStatusChangeAction(action)) {
    return { success: await handlers.onUpdateCampaignSettings(action.payload) };
  }

  if (isCreateCampaignEventAction(action)) {
    return { success: await handlers.onCreateScheduleEvent(action.payload) };
  }

  if (isCreateCommunicationScheduleAction(action)) {
    const templateId =
      action.payload.templateId ??
      (action.payload.templateRef
        ? createdRefs.createdTemplateRefs.get(action.payload.templateRef) ?? null
        : null);
    if (!templateId) {
      handlers.onDraftError('Apply the template draft first so this communication can be placed.');
      return { success: false };
    }

    return {
      success: await handlers.onCreateCommunicationSchedule({
        templateId,
        milestoneKey: action.payload.milestoneKey ?? null,
        scheduledFor: action.payload.scheduledFor ?? null,
        status: action.payload.status,
        notes: action.payload.notes ?? null,
      }),
    };
  }

  if (isCreateMilestoneAction(action)) {
    const nextMilestones = handlers.milestones
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
    return { success: await handlers.onSaveMilestones(nextMilestones) };
  }

  return { success: false };
}
