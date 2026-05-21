import { apiFetchJson } from '@/shared/api/client';
import type {
  CampaignStudioAiAction,
  CampaignStudioAiDraftRequest,
  CampaignStudioAiDraftResponse,
} from '@/features/campaigns/model/campaignStudioAiDraft';

interface CampaignStudioAiApplyTargetResponse {
  api: string;
  method: CampaignStudioAiAction['applyTarget']['method'];
}

interface CampaignStudioAiActionResponse {
  id: string;
  action_type: CampaignStudioAiAction['actionType'];
  section: CampaignStudioAiAction['section'];
  title: string;
  summary: string;
  status: CampaignStudioAiAction['status'];
  assumptions: string[];
  warnings: string[];
  payload: Record<string, unknown>;
  apply_target: CampaignStudioAiApplyTargetResponse;
}

interface CampaignStudioAiDraftResponseBody {
  message: string;
  assumptions: string[];
  warnings: string[];
  actions: CampaignStudioAiActionResponse[];
}

export async function draftCampaignStudioAi(
  campaignId: string,
  input: CampaignStudioAiDraftRequest
): Promise<CampaignStudioAiDraftResponse> {
  const response = await apiFetchJson<CampaignStudioAiDraftResponseBody>(
    `/api/v1/campaigns/${campaignId}/ai/draft`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: input.section,
        prompt: input.prompt,
        requested_action_type: input.requestedActionType ?? null,
      }),
    }
  );

  return {
    message: response.message,
    assumptions: response.assumptions,
    warnings: response.warnings,
    actions: response.actions.map(mapAiAction),
  };
}

function mapAiAction(action: CampaignStudioAiActionResponse): CampaignStudioAiAction {
  return {
    id: action.id,
    actionType: action.action_type,
    section: action.section,
    title: action.title,
    summary: action.summary,
    status: action.status,
    assumptions: action.assumptions,
    warnings: action.warnings,
    payload: mapActionPayload(action),
    applyTarget: {
      api: action.apply_target.api,
      method: action.apply_target.method,
    },
  };
}

function mapActionPayload(action: CampaignStudioAiActionResponse): Record<string, unknown> {
  if (
    action.action_type === 'create_template' ||
    action.action_type === 'update_template' ||
    action.action_type === 'duplicate_template'
  ) {
    return {
      templateRef: action.payload.template_ref ?? null,
      templateKey: action.payload.template_key,
      name: action.payload.name,
      audience: action.payload.audience,
      subjectTemplate: action.payload.subject_template,
      bodyTemplate: action.payload.body_template,
      isActive: action.payload.is_active ?? true,
    };
  }

  if (action.action_type === 'create_team' || action.action_type === 'update_team') {
    return {
      teamRef: action.payload.team_ref ?? null,
      name: action.payload.name,
      description: action.payload.description ?? null,
      isActive: action.payload.is_active ?? true,
    };
  }

  if (action.action_type === 'create_team_role' || action.action_type === 'update_team_role') {
    return {
      teamId: action.payload.team_id ?? null,
      teamRef: action.payload.team_ref ?? null,
      roleRef: action.payload.role_ref ?? null,
      name: action.payload.name,
      description: action.payload.description ?? null,
      sortOrder: Number(action.payload.sort_order ?? 0),
      isActive: action.payload.is_active ?? true,
    };
  }

  if (action.action_type === 'create_member' || action.action_type === 'update_member') {
    return {
      memberRef: action.payload.member_ref ?? null,
      displayName: action.payload.display_name,
      email: action.payload.email ?? null,
      phone: action.payload.phone ?? null,
      notes: action.payload.notes ?? null,
      memberType: action.payload.member_type,
      appAccessStatus: action.payload.app_access_status ?? 'none',
      isActive: action.payload.is_active ?? true,
    };
  }

  if (action.action_type === 'assign_member_to_team') {
    return {
      teamId: action.payload.team_id ?? null,
      teamRef: action.payload.team_ref ?? null,
      memberId: action.payload.member_id ?? null,
      memberRef: action.payload.member_ref ?? null,
      teamRoleId: action.payload.team_role_id ?? null,
      teamRoleRef: action.payload.team_role_ref ?? null,
    };
  }

  if (action.action_type === 'assign_app_access_role') {
    return {
      memberId: action.payload.member_id ?? null,
      memberRef: action.payload.member_ref ?? null,
      roleKey: action.payload.role_key,
      isActive: action.payload.is_active ?? true,
    };
  }

  if (action.action_type === 'update_campaign_settings') {
    return {
      name: action.payload.name,
      year: Number(action.payload.year),
      description: action.payload.description ?? null,
      status: action.payload.status,
      startDate: action.payload.start_date ?? null,
      endDate: action.payload.end_date ?? null,
    };
  }

  if (action.action_type === 'create_event' || action.action_type === 'update_event') {
    return {
      title: action.payload.title,
      eventType: action.payload.event_type,
      startAt: action.payload.start_at,
      endAt: action.payload.end_at ?? null,
      allDay: Boolean(action.payload.all_day),
      notes: action.payload.notes ?? null,
    };
  }

  if (action.action_type === 'create_milestone' || action.action_type === 'update_milestone') {
    return {
      milestoneKey: action.payload.milestone_key,
      label: action.payload.label,
      occursOn: action.payload.occurs_on,
      notes: action.payload.notes ?? null,
      sortOrder: Number(action.payload.sort_order ?? 0),
    };
  }

  if (
    action.action_type === 'create_communication_schedule' ||
    action.action_type === 'update_communication_schedule'
  ) {
    return {
      templateId: action.payload.template_id ?? null,
      templateRef: action.payload.template_ref ?? null,
      milestoneKey: action.payload.milestone_key ?? null,
      scheduledFor: action.payload.scheduled_for ?? null,
      status: action.payload.status,
      notes: action.payload.notes ?? null,
    };
  }

  return action.payload;
}
