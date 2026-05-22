import type {
  Campaign,
  CampaignAccess,
  CampaignSummary,
} from '@/features/campaigns/model/campaignTypes';

export interface CampaignTeamMember {
  id: string;
  email: string;
  displayName: string;
  appRole: string;
  isActive: boolean;
}

export interface CampaignAssignment {
  id: string;
  campaignId: string;
  userId: string;
  roleKey: string;
  isActive: boolean;
  user: CampaignTeamMember;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignTeamCounts {
  assignmentCount: number;
  activeAssignmentCount: number;
  memberCount: number;
  managerCount: number;
  roleCounts: Record<string, number>;
}

export interface CampaignTeamSnapshot {
  assignments: CampaignAssignment[];
  counts: CampaignTeamCounts;
}

export interface CampaignDirectoryUser {
  id: string;
  email: string;
  displayName: string;
  appRole: string;
  isActive: boolean;
  assignedRoleKeys: string[];
  inactiveRoleKeys: string[];
}

export type CommunicationAudienceKey =
  | 'SPONSOR'
  | 'VOLUNTEER'
  | 'MANAGER'
  | 'HOUSEHOLD_CONTACT'
  | 'ADULT_PROGRAM_CONTACT'
  | 'GROUP_PRIMARY_CONTACT'
  | 'ADULT_RECIPIENT_DIRECT'
  | 'GENERAL';

export interface CommunicationAudienceOption {
  key: CommunicationAudienceKey;
  label: string;
  description: string;
}

export interface CommunicationTemplate {
  id: string;
  campaignId: string;
  templateKey: string;
  name: string;
  audience: CommunicationAudienceKey;
  channel: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CommunicationSchedule {
  id: string;
  campaignId: string;
  templateId: string;
  template: CommunicationTemplate;
  milestoneKey: string | null;
  scheduledFor: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'DISABLED';
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignMilestone {
  id: string;
  campaignId: string;
  milestoneKey: string;
  label: string;
  occursOn: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export type CampaignScheduleSourceType = 'manual' | 'milestone' | 'communication';

export type CampaignScheduleEventType =
  | 'GENERAL'
  | 'VOLUNTEER'
  | 'SPONSOR'
  | 'DONATION'
  | 'RECIPIENT'
  | 'GIFT'
  | 'PICKUP'
  | 'COMMUNICATION'
  | 'MILESTONE';

export interface CampaignScheduleItem {
  id: string;
  title: string;
  eventType: CampaignScheduleEventType;
  sourceType: CampaignScheduleSourceType;
  sourceId: string | null;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  notes: string | null;
  isEditable: boolean;
}

export interface CampaignReadinessItem {
  severity: 'error' | 'warning' | 'info';
  category: 'blockers' | 'launch_checks' | 'planning_gaps' | 'operational_health';
  code: string;
  section: string;
  message: string;
  actionLabel: string;
  blockingFor: Array<'draft' | 'activate' | 'operations' | 'close'>;
  details: Record<string, unknown>;
}

export interface CampaignReadiness {
  campaignId: string;
  status: 'READY' | 'NEEDS_ATTENTION' | 'BLOCKED';
  overallStatus: 'READY' | 'NEEDS_ATTENTION' | 'BLOCKED';
  phaseStatus: Record<'draft' | 'activate' | 'operations' | 'close', 'READY' | 'NEEDS_ATTENTION' | 'BLOCKED'>;
  items: CampaignReadinessItem[];
  groups: Record<
    'blockers' | 'launch_checks' | 'planning_gaps' | 'operational_health',
    CampaignReadinessItem[]
  >;
  counts: {
    errors: number;
    warnings: number;
    infos: number;
  };
  categoryCounts: Record<
    'blockers' | 'launch_checks' | 'planning_gaps' | 'operational_health',
    number
  >;
}

export interface CampaignStudioData {
  campaign: Campaign;
  access: CampaignAccess;
  summary: CampaignSummary;
  team: CampaignTeamSnapshot;
  communications: {
    audienceCatalog: CommunicationAudienceOption[];
    templates: CommunicationTemplate[];
    schedules: CommunicationSchedule[];
  };
  schedule: {
    items: CampaignScheduleItem[];
  };
  milestones: CampaignMilestone[];
  readiness: CampaignReadiness;
}

export interface CreateCommunicationTemplateInput {
  templateKey: string;
  name: string;
  audience: CommunicationAudienceKey;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive?: boolean;
}

export interface UpdateCommunicationTemplateInput {
  templateKey?: string;
  name?: string;
  audience?: CommunicationAudienceKey;
  subjectTemplate?: string;
  bodyTemplate?: string;
  isActive?: boolean;
}

export interface CreateCampaignAssignmentInput {
  userId: string;
  roleKey: string;
  isActive?: boolean;
}

export interface CreateCommunicationScheduleInput {
  templateId: string;
  milestoneKey?: string | null;
  scheduledFor?: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'DISABLED';
  notes?: string | null;
}

export interface UpdateCommunicationScheduleInput {
  templateId?: string;
  milestoneKey?: string | null;
  scheduledFor?: string | null;
  status?: 'DRAFT' | 'SCHEDULED' | 'DISABLED';
  notes?: string | null;
}

export interface SaveCampaignMilestoneInput {
  milestoneKey: string;
  label: string;
  occursOn: string;
  notes?: string | null;
  sortOrder: number;
}

export interface CreateCampaignEventInput {
  title: string;
  eventType: CampaignScheduleEventType;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  notes?: string | null;
}

export interface UpdateCampaignEventInput {
  title?: string;
  eventType?: CampaignScheduleEventType;
  startAt?: string;
  endAt?: string | null;
  allDay?: boolean;
  notes?: string | null;
}
