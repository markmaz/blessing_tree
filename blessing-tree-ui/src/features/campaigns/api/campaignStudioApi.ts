import { apiFetchJson } from '@/shared/api/client';
import { mapCampaignScheduleItem } from '@/features/campaigns/api/campaignStudioScheduleApi';
import {
  type CampaignAssignment,
  type CampaignMilestone,
  type CampaignReadiness,
  type CampaignScheduleItem,
  type CampaignStudioData,
  type CampaignTeamSnapshot,
  type CommunicationAudienceOption,
  type CommunicationSchedule,
  type CommunicationTemplate,
  type CreateCommunicationScheduleInput,
  type CreateCommunicationTemplateInput,
  type SaveCampaignMilestoneInput,
  type UpdateCommunicationTemplateInput,
  type UpdateCommunicationScheduleInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import {
  type Campaign,
  type CampaignAccess,
  type CampaignSummary,
} from '@/features/campaigns/model/campaignTypes';

interface CampaignAccessResponse {
  campaign_id: string;
  global_app_role: string;
  role_keys: string[];
  capabilities: string[];
}

interface CampaignResponse {
  id: string;
  name: string;
  year: number;
  description: string | null;
  status: Campaign['status'];
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CampaignSummaryResponse {
  campaign_id: string;
  counts: Record<string, number>;
}

interface CampaignTeamMemberResponse {
  id: string;
  email: string;
  display_name: string;
  app_role: string;
  is_active: boolean;
}

interface CampaignAssignmentResponse {
  id: string;
  campaign_id: string;
  user_id: string;
  role_key: string;
  is_active: boolean;
  user: CampaignTeamMemberResponse;
  created_at: string | null;
  updated_at: string | null;
}

interface CampaignTeamSnapshotResponse {
  assignments: CampaignAssignmentResponse[];
  counts: {
    assignment_count: number;
    active_assignment_count: number;
    member_count: number;
    manager_count: number;
    role_counts: Record<string, number>;
  };
}

interface CommunicationTemplateResponse {
  id: string;
  campaign_id: string;
  template_key: string;
  name: string;
  audience: CommunicationTemplate['audience'];
  channel: string;
  subject_template: string;
  body_template: string;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CommunicationAudienceOptionResponse {
  key: CommunicationAudienceOption['key'];
  label: string;
  description: string;
}

interface CommunicationScheduleResponse {
  id: string;
  campaign_id: string;
  template_id: string;
  template: CommunicationTemplateResponse;
  milestone_key: string | null;
  scheduled_for: string | null;
  status: CommunicationSchedule['status'];
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CampaignMilestoneResponse {
  id: string;
  campaign_id: string;
  milestone_key: string;
  label: string;
  occurs_on: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

interface CampaignScheduleItemResponse {
  id: string;
  title: string;
  event_type: CampaignScheduleItem['eventType'];
  source_type: CampaignScheduleItem['sourceType'];
  source_id: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  notes: string | null;
  is_editable: boolean;
}

interface CampaignReadinessItemResponse {
  severity: CampaignReadiness['items'][number]['severity'];
  category: CampaignReadiness['items'][number]['category'];
  code: string;
  section: string;
  message: string;
  action_label: string;
  blocking_for: CampaignReadiness['items'][number]['blockingFor'];
  details: Record<string, unknown>;
}

interface CampaignReadinessResponse {
  campaign_id: string;
  status: CampaignReadiness['status'];
  overall_status: CampaignReadiness['overallStatus'];
  phase_status: CampaignReadiness['phaseStatus'];
  items: CampaignReadinessItemResponse[];
  groups: Record<
    'blockers' | 'launch_checks' | 'planning_gaps' | 'operational_health',
    CampaignReadinessItemResponse[]
  >;
  counts: {
    errors: number;
    warnings: number;
    infos: number;
  };
  category_counts: CampaignReadiness['categoryCounts'];
}

interface CampaignStudioResponse {
  campaign: CampaignResponse;
  access: CampaignAccessResponse;
  summary: CampaignSummaryResponse;
  team: CampaignTeamSnapshotResponse;
  communications: {
    audience_catalog: CommunicationAudienceOptionResponse[];
    templates: CommunicationTemplateResponse[];
    schedules: CommunicationScheduleResponse[];
  };
  schedule: {
    items: CampaignScheduleItemResponse[];
  };
  milestones: CampaignMilestoneResponse[];
  readiness: CampaignReadinessResponse;
}

export async function getCampaignStudio(campaignId: string): Promise<CampaignStudioData> {
  const response = await apiFetchJson<CampaignStudioResponse>(
    `/api/v1/campaigns/${campaignId}/studio`
  );

  return {
    campaign: mapCampaign(response.campaign),
    access: mapCampaignAccess(response.access),
    summary: mapCampaignSummary(response.summary),
    team: mapTeamSnapshot(response.team),
    communications: {
      audienceCatalog: response.communications.audience_catalog.map(
        mapCommunicationAudienceOption
      ),
      templates: response.communications.templates.map(mapCommunicationTemplate),
      schedules: response.communications.schedules.map(mapCommunicationSchedule),
    },
    schedule: {
      items: response.schedule.items.map(mapCampaignScheduleItem),
    },
    milestones: response.milestones.map(mapCampaignMilestone),
    readiness: mapCampaignReadiness(response.readiness),
  };
}

export async function createCommunicationTemplate(
  campaignId: string,
  input: CreateCommunicationTemplateInput
): Promise<CommunicationTemplate> {
  const response = await apiFetchJson<CommunicationTemplateResponse>(
    `/api/v1/campaigns/${campaignId}/communications/templates`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_key: input.templateKey,
        name: input.name,
        audience: input.audience,
        channel: 'EMAIL',
        subject_template: input.subjectTemplate,
        body_template: input.bodyTemplate,
        is_active: input.isActive ?? true,
      }),
    }
  );

  return mapCommunicationTemplate(response);
}

export async function updateCommunicationTemplate(
  campaignId: string,
  templateId: string,
  input: UpdateCommunicationTemplateInput
): Promise<CommunicationTemplate> {
  const payload: Record<string, unknown> = {};
  if ('templateKey' in input) {
    payload.template_key = input.templateKey;
  }
  if ('name' in input) {
    payload.name = input.name;
  }
  if ('audience' in input) {
    payload.audience = input.audience;
  }
  if ('subjectTemplate' in input) {
    payload.subject_template = input.subjectTemplate;
  }
  if ('bodyTemplate' in input) {
    payload.body_template = input.bodyTemplate;
  }
  if ('isActive' in input) {
    payload.is_active = input.isActive;
  }

  const response = await apiFetchJson<CommunicationTemplateResponse>(
    `/api/v1/campaigns/${campaignId}/communications/templates/${templateId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  return mapCommunicationTemplate(response);
}

export async function deleteCommunicationTemplate(
  campaignId: string,
  templateId: string
): Promise<void> {
  await apiFetchJson(`/api/v1/campaigns/${campaignId}/communications/templates/${templateId}`, {
    method: 'DELETE',
  });
}

export async function createCommunicationSchedule(
  campaignId: string,
  input: CreateCommunicationScheduleInput
): Promise<CommunicationSchedule> {
  const response = await apiFetchJson<CommunicationScheduleResponse>(
    `/api/v1/campaigns/${campaignId}/communications/schedules`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: input.templateId,
        milestone_key: input.milestoneKey ?? null,
        scheduled_for: input.scheduledFor ?? null,
        status: input.status,
        notes: input.notes ?? null,
      }),
    }
  );

  return mapCommunicationSchedule(response);
}

export async function updateCommunicationSchedule(
  campaignId: string,
  scheduleId: string,
  input: UpdateCommunicationScheduleInput
): Promise<CommunicationSchedule> {
  const payload: Record<string, unknown> = {};
  if ('templateId' in input) {
    payload.template_id = input.templateId;
  }
  if ('milestoneKey' in input) {
    payload.milestone_key = input.milestoneKey ?? null;
  }
  if ('scheduledFor' in input) {
    payload.scheduled_for = input.scheduledFor ?? null;
  }
  if ('status' in input) {
    payload.status = input.status;
  }
  if ('notes' in input) {
    payload.notes = input.notes ?? null;
  }

  const response = await apiFetchJson<CommunicationScheduleResponse>(
    `/api/v1/campaigns/${campaignId}/communications/schedules/${scheduleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  return mapCommunicationSchedule(response);
}

export async function deleteCommunicationSchedule(
  campaignId: string,
  scheduleId: string
): Promise<void> {
  await apiFetchJson(`/api/v1/campaigns/${campaignId}/communications/schedules/${scheduleId}`, {
    method: 'DELETE',
  });
}

export async function saveCampaignMilestones(
  campaignId: string,
  milestones: SaveCampaignMilestoneInput[]
): Promise<CampaignMilestone[]> {
  const response = await apiFetchJson<CampaignMilestoneResponse[]>(
    `/api/v1/campaigns/${campaignId}/milestones`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestones: milestones.map((milestone) => ({
          milestone_key: milestone.milestoneKey,
          label: milestone.label,
          occurs_on: milestone.occursOn,
          notes: milestone.notes ?? null,
          sort_order: milestone.sortOrder,
        })),
      }),
    }
  );

  return response.map(mapCampaignMilestone);
}

function mapCampaign(campaign: CampaignResponse): Campaign {
  return {
    id: campaign.id,
    name: campaign.name,
    year: campaign.year,
    description: campaign.description,
    status: campaign.status,
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  };
}

function mapCampaignAccess(access: CampaignAccessResponse): CampaignAccess {
  return {
    campaignId: access.campaign_id,
    globalAppRole: access.global_app_role,
    roleKeys: access.role_keys,
    capabilities: access.capabilities,
  };
}

function mapCampaignSummary(summary: CampaignSummaryResponse): CampaignSummary {
  return {
    campaignId: summary.campaign_id,
    counts: {
      recipientGroups: summary.counts.recipient_groups ?? 0,
      recipients: summary.counts.recipients ?? 0,
      wishlists: summary.counts.wishlists ?? 0,
      wishlistItems: summary.counts.wishlist_items ?? 0,
      donations: summary.counts.donations ?? 0,
      sponsorships: summary.counts.sponsorships ?? 0,
      sponsorshipItems: summary.counts.sponsorship_items ?? 0,
      fulfillments: summary.counts.fulfillments ?? 0,
      pickups: summary.counts.pickups ?? 0,
    },
  };
}

function mapTeamSnapshot(team: CampaignTeamSnapshotResponse): CampaignTeamSnapshot {
  return {
    assignments: team.assignments.map(mapCampaignAssignment),
    counts: {
      assignmentCount: team.counts.assignment_count,
      activeAssignmentCount: team.counts.active_assignment_count,
      memberCount: team.counts.member_count,
      managerCount: team.counts.manager_count,
      roleCounts: team.counts.role_counts,
    },
  };
}

function mapCampaignAssignment(
  assignment: CampaignAssignmentResponse
): CampaignAssignment {
  return {
    id: assignment.id,
    campaignId: assignment.campaign_id,
    userId: assignment.user_id,
    roleKey: assignment.role_key,
    isActive: assignment.is_active,
    user: {
      id: assignment.user.id,
      email: assignment.user.email,
      displayName: assignment.user.display_name,
      appRole: assignment.user.app_role,
      isActive: assignment.user.is_active,
    },
    createdAt: assignment.created_at,
    updatedAt: assignment.updated_at,
  };
}

function mapCommunicationTemplate(
  template: CommunicationTemplateResponse
): CommunicationTemplate {
  return {
    id: template.id,
    campaignId: template.campaign_id,
    templateKey: template.template_key,
    name: template.name,
    audience: template.audience,
    channel: template.channel,
    subjectTemplate: template.subject_template,
    bodyTemplate: template.body_template,
    isActive: template.is_active,
    createdByUserId: template.created_by_user_id,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
}

function mapCommunicationAudienceOption(
  option: CommunicationAudienceOptionResponse
): CommunicationAudienceOption {
  return {
    key: option.key,
    label: option.label,
    description: option.description,
  };
}

function mapCommunicationSchedule(
  schedule: CommunicationScheduleResponse
): CommunicationSchedule {
  return {
    id: schedule.id,
    campaignId: schedule.campaign_id,
    templateId: schedule.template_id,
    template: mapCommunicationTemplate(schedule.template),
    milestoneKey: schedule.milestone_key,
    scheduledFor: schedule.scheduled_for,
    status: schedule.status,
    notes: schedule.notes,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
  };
}

function mapCampaignMilestone(
  milestone: CampaignMilestoneResponse
): CampaignMilestone {
  return {
    id: milestone.id,
    campaignId: milestone.campaign_id,
    milestoneKey: milestone.milestone_key,
    label: milestone.label,
    occursOn: milestone.occurs_on,
    notes: milestone.notes,
    sortOrder: milestone.sort_order,
    createdAt: milestone.created_at,
    updatedAt: milestone.updated_at,
  };
}

function mapCampaignReadiness(
  readiness: CampaignReadinessResponse
): CampaignReadiness {
  return {
    campaignId: readiness.campaign_id,
    status: readiness.status,
    overallStatus: readiness.overall_status,
    phaseStatus: readiness.phase_status,
    items: readiness.items.map(mapCampaignReadinessItem),
    groups: {
      blockers: readiness.groups.blockers.map(mapCampaignReadinessItem),
      launch_checks: readiness.groups.launch_checks.map(mapCampaignReadinessItem),
      planning_gaps: readiness.groups.planning_gaps.map(mapCampaignReadinessItem),
      operational_health: readiness.groups.operational_health.map(mapCampaignReadinessItem),
    },
    counts: readiness.counts,
    categoryCounts: readiness.category_counts,
  };
}

function mapCampaignReadinessItem(
  item: CampaignReadinessItemResponse
): CampaignReadiness['items'][number] {
  return {
    severity: item.severity,
    category: item.category,
    code: item.code,
    section: item.section,
    message: item.message,
    actionLabel: item.action_label,
    blockingFor: item.blocking_for,
    details: item.details,
  };
}
