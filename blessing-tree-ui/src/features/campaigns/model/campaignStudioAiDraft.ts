import type { CampaignStudioSectionId } from '@/features/campaigns/model/campaignStudio';
import type {
  CreateCampaignEventInput,
  CreateCommunicationTemplateInput,
  CreateCommunicationScheduleInput,
  SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';

export type ScheduleAiDraftType = 'event' | 'milestone' | 'communication';

export type CampaignStudioAiActionStatus = 'ready' | 'needs_review' | 'blocked';

export type CampaignStudioAiActionType =
  | 'create_template'
  | 'update_template'
  | 'duplicate_template'
  | 'create_event'
  | 'update_event'
  | 'create_milestone'
  | 'update_milestone'
  | 'create_communication_schedule'
  | 'update_communication_schedule'
  | 'create_member'
  | 'update_member'
  | 'create_team'
  | 'update_team'
  | 'create_team_role'
  | 'update_team_role'
  | 'assign_member_to_team'
  | 'assign_app_access_role'
  | 'resolve_readiness_gap'
  | 'batch_fix_plan'
  | 'update_campaign_settings'
  | 'suggest_status_change';

export interface CampaignStudioAiApplyTarget {
  api: string;
  method: 'POST' | 'PATCH' | 'PUT';
}

export interface CampaignStudioAiAction {
  id: string;
  actionType: CampaignStudioAiActionType;
  section: CampaignStudioSectionId;
  title: string;
  summary: string;
  status: CampaignStudioAiActionStatus;
  assumptions: string[];
  warnings: string[];
  payload: Record<string, unknown>;
  applyTarget: CampaignStudioAiApplyTarget;
}

export interface CampaignStudioAiDraftResponse {
  message: string;
  assumptions: string[];
  warnings: string[];
  actions: CampaignStudioAiAction[];
}

export interface CampaignStudioAiDraftRequest {
  section: CampaignStudioSectionId;
  prompt: string;
  requestedActionType?: ScheduleAiDraftType | null;
}

export interface CreateCommunicationTemplateAiPayload
  extends CreateCommunicationTemplateInput {
  templateRef?: string | null;
}

export interface CreateCommunicationScheduleAiPayload
  extends Omit<CreateCommunicationScheduleInput, 'templateId'> {
  templateId: string | null;
  templateRef?: string | null;
}

export function isCreateCommunicationTemplateAction(
  action: CampaignStudioAiAction
): action is CampaignStudioAiAction & { payload: CreateCommunicationTemplateAiPayload } {
  return action.actionType === 'create_template';
}

export function isCreateCampaignEventAction(
  action: CampaignStudioAiAction
): action is CampaignStudioAiAction & { payload: CreateCampaignEventInput } {
  return action.actionType === 'create_event';
}

export function isCreateCommunicationScheduleAction(
  action: CampaignStudioAiAction
): action is CampaignStudioAiAction & { payload: CreateCommunicationScheduleAiPayload } {
  return action.actionType === 'create_communication_schedule';
}

export function isCreateMilestoneAction(
  action: CampaignStudioAiAction
): action is CampaignStudioAiAction & { payload: SaveCampaignMilestoneInput } {
  return action.actionType === 'create_milestone';
}
