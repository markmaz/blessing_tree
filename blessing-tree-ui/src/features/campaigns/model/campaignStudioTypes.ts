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
  | 'ORGANIZATION_CONTACT'
  | 'GROUP_PRIMARY_CONTACT'
  | 'ADULT_RECIPIENT_DIRECT'
  | 'GENERAL';

export interface CommunicationAudienceOption {
  key: CommunicationAudienceKey;
  label: string;
  description: string;
}

export interface CommunicationAudienceRecipientSummary {
  audience: CommunicationAudienceKey;
  count: number;
  sampleRecipients: Array<{
    displayName: string;
    email: string;
  }>;
  recipients: Array<{
    displayName: string;
    email: string;
  }>;
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

export interface CommunicationSendHistoryItem {
  id: string;
  campaignId: string;
  templateId: string;
  templateName: string;
  targetMode: string;
  status: string;
  subject: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdByDisplayName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  recipients: CommunicationSendHistoryRecipient[];
}

export interface CommunicationSendHistoryRecipient {
  id: string;
  sendId: string;
  recipientType: string;
  recipientRefId: string | null;
  email: string;
  displayName: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

export interface CommunicationRecipientOption {
  id: string;
  label: string;
  email: string | null;
  description: string | null;
  memberCount?: number;
}

export interface CommunicationRecipientOptions {
  teams: CommunicationRecipientOption[];
  sponsors: CommunicationRecipientOption[];
  members: CommunicationRecipientOption[];
  contacts: CommunicationRecipientOption[];
}

export type CommunicationSendTargetMode =
  | 'AUDIENCE'
  | 'TEAM'
  | 'SELECTED_SPONSORS'
  | 'SELECTED_MEMBERS'
  | 'SELECTED_CONTACTS'
  | 'MANUAL_EMAIL';

export interface CommunicationSendManualRecipientInput {
  email: string;
  displayName?: string | null;
}

export interface CreateCommunicationSendInput {
  templateId: string;
  targetMode: CommunicationSendTargetMode;
  manualRecipients?: CommunicationSendManualRecipientInput[];
  teamIds?: string[];
  sponsorIds?: string[];
  memberIds?: string[];
  contactIds?: string[];
}

export interface CommunicationSendResult {
  sendId: string;
  templateId: string;
  targetMode: string;
  status: string;
  subject: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage: string | null;
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

export interface CampaignMilestoneDefinition {
  id: string | null;
  milestoneKey: string;
  label: string;
  description: string | null;
  featureArea: string;
  defaultSortOrder: number;
  isActive: boolean;
  isSystem: boolean;
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

export type CampaignCalendarUrgency =
  | 'missing'
  | 'overdue'
  | 'today'
  | 'due_soon'
  | 'upcoming'
  | 'future'
  | 'complete'
  | 'informational';

export type CampaignCalendarItemType =
  | 'campaign_date'
  | 'milestone'
  | 'manual_event'
  | 'communication'
  | 'sponsor_dropoff'
  | 'sponsor_followup'
  | 'gift_workflow'
  | 'readiness_blocker'
  | 'missing_date';

export interface CampaignCalendarIntelligenceItem {
  id: string;
  title: string;
  description: string | null;
  itemType: CampaignCalendarItemType;
  urgency: CampaignCalendarUrgency;
  date: string | null;
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean;
  isBlocker: boolean;
  isMissing: boolean;
  isOverdue: boolean;
  count: number | null;
  sourceType: string;
  sourceId: string | null;
  routeName: string | null;
  metadata: Record<string, unknown>;
}

export interface CampaignCalendarCriticalDate {
  key: string;
  label: string;
  date: string | null;
  status: CampaignCalendarUrgency;
  isBlocker: boolean;
  sourceType: string;
  sourceId: string | null;
  routeName: string | null;
}

export interface CampaignCalendarAgendaGroup {
  key: string;
  label: string;
  items: CampaignCalendarIntelligenceItem[];
}

export interface CampaignCalendarIntelligence {
  campaignId: string;
  generatedAt: string | null;
  summary: {
    totalItems: number;
    overdueCount: number;
    dueSoonCount: number;
    missingCriticalDatesCount: number;
    scheduledCommunicationsCount: number;
    blockerCount: number;
  };
  criticalDates: CampaignCalendarCriticalDate[];
  agendaGroups: CampaignCalendarAgendaGroup[];
  items: CampaignCalendarIntelligenceItem[];
  warnings: Array<{
    code: string;
    message: string;
    severity: string;
  }>;
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

export type RecipientCoverageRule =
  | 'ONE_GIFT_SPONSORED'
  | 'MIN_GIFTS_SPONSORED'
  | 'ALL_GIFTS_SPONSORED';

export interface CampaignGiftPolicy {
  id: string;
  campaignId: string;
  maxGiftsPerSponsor: number;
  maxWishlistItemsPerRecipient: number;
  recipientCoverageRule: RecipientCoverageRule;
  recipientCoverageRequiredCount: number;
  allowPartialSponsorCommitments: boolean;
  reservationHoldMinutes: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CampaignStudioData {
  campaign: Campaign;
  access: CampaignAccess;
  summary: CampaignSummary;
  team: CampaignTeamSnapshot;
  communications: {
    audienceCatalog: CommunicationAudienceOption[];
    audienceRecipientSummaries: CommunicationAudienceRecipientSummary[];
    templates: CommunicationTemplate[];
    schedules: CommunicationSchedule[];
    sends: CommunicationSendHistoryItem[];
    recipientOptions: CommunicationRecipientOptions;
  };
  schedule: {
    items: CampaignScheduleItem[];
  };
  milestoneDefinitions: CampaignMilestoneDefinition[];
  milestones: CampaignMilestone[];
  giftPolicy: CampaignGiftPolicy;
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

export interface CommunicationTemplateTestEmailResult {
  templateId: string;
  recipientEmail: string;
  subject: string;
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

export interface UpdateCampaignGiftPolicyInput {
  maxGiftsPerSponsor?: number;
  maxWishlistItemsPerRecipient?: number;
  recipientCoverageRule?: RecipientCoverageRule;
  recipientCoverageRequiredCount?: number;
  allowPartialSponsorCommitments?: boolean;
  reservationHoldMinutes?: number;
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
