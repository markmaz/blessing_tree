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

export interface CommunicationTemplate {
  id: string;
  templateKey: string;
  name: string;
  audience: string;
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

export interface CampaignReadinessItem {
  severity: 'error' | 'warning' | 'info';
  code: string;
  section: string;
  message: string;
  details: Record<string, unknown>;
}

export interface CampaignReadiness {
  campaignId: string;
  status: 'READY' | 'NEEDS_ATTENTION' | 'BLOCKED';
  items: CampaignReadinessItem[];
  counts: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface CampaignStudioData {
  campaign: Campaign;
  access: CampaignAccess;
  summary: CampaignSummary;
  team: CampaignTeamSnapshot;
  communications: {
    templates: CommunicationTemplate[];
    schedules: CommunicationSchedule[];
  };
  milestones: CampaignMilestone[];
  readiness: CampaignReadiness;
}

export interface CreateCommunicationTemplateInput {
  templateKey: string;
  name: string;
  audience: string;
  subjectTemplate: string;
  bodyTemplate: string;
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

export interface SaveCampaignMilestoneInput {
  milestoneKey: string;
  label: string;
  occursOn: string;
  notes?: string | null;
  sortOrder: number;
}
