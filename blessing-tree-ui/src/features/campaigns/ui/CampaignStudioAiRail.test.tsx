import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draftCampaignStudioAi } from '@/features/campaigns/api/campaignStudioAiApi';
import { CampaignStudioAiRail } from '@/features/campaigns/ui/CampaignStudioAiRail';
import type {
  CampaignMilestone,
  CampaignReadiness,
  CampaignScheduleItem,
  CommunicationTemplate,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';

vi.mock('@/features/campaigns/api/campaignStudioAiApi', () => ({
  draftCampaignStudioAi: vi.fn(),
}));

const campaign: Campaign = {
  id: 'campaign-123',
  name: 'Blessing Tree 2026 Demo',
  year: 2026,
  description: 'Demo campaign',
  status: 'ACTIVE',
  startDate: '2026-11-01',
  endDate: '2026-12-20',
  createdAt: null,
  updatedAt: null,
};

const readiness: CampaignReadiness = {
  campaignId: 'campaign-123',
  status: 'NEEDS_ATTENTION',
  overallStatus: 'NEEDS_ATTENTION',
  phaseStatus: {
    draft: 'NEEDS_ATTENTION',
    activate: 'BLOCKED',
    operations: 'NEEDS_ATTENTION',
    close: 'READY',
  },
  items: [
    {
      severity: 'warning',
      category: 'planning_gaps',
      code: 'missing_manual_schedule',
      section: 'schedule',
      message: 'Add at least one manual planning event to shape the campaign timeline.',
      actionLabel: 'Open Schedule',
      blockingFor: [],
      details: {},
    },
    {
      severity: 'warning',
      category: 'launch_checks',
      code: 'missing_schedule_messaging',
      section: 'schedule',
      message: 'Add communication timing for the key milestones already on the calendar.',
      actionLabel: 'Open Schedule',
      blockingFor: ['activate'],
      details: { missing_keys: ['registration_open'] },
    },
  ],
  groups: {
    blockers: [],
    launch_checks: [
      {
        severity: 'warning',
        category: 'launch_checks',
        code: 'missing_schedule_messaging',
        section: 'schedule',
        message: 'Add communication timing for the key milestones already on the calendar.',
        actionLabel: 'Open Schedule',
        blockingFor: ['activate'],
        details: { missing_keys: ['registration_open'] },
      },
    ],
    planning_gaps: [
      {
        severity: 'warning',
        category: 'planning_gaps',
        code: 'missing_manual_schedule',
        section: 'schedule',
        message: 'Add at least one manual planning event to shape the campaign timeline.',
        actionLabel: 'Open Schedule',
        blockingFor: [],
        details: {},
      },
    ],
    operational_health: [],
  },
  counts: {
    errors: 0,
    warnings: 2,
    infos: 0,
  },
  categoryCounts: {
    blockers: 0,
    launch_checks: 1,
    planning_gaps: 1,
    operational_health: 0,
  },
};

const milestones: CampaignMilestone[] = [
  {
    id: 'milestone-1',
    campaignId: 'campaign-123',
    milestoneKey: 'registration_open',
    label: 'Registration Opens',
    occursOn: '2026-11-15',
    notes: null,
    sortOrder: 1,
    createdAt: null,
    updatedAt: null,
  },
];

const templates: CommunicationTemplate[] = [
  {
    id: 'template-1',
    templateKey: 'volunteer_reminder',
    name: 'Volunteer Reminder',
    audience: 'VOLUNTEER',
    channel: 'EMAIL',
    subjectTemplate: 'Reminder',
    bodyTemplate: 'Please join us.',
    isActive: true,
    createdByUserId: null,
    createdAt: null,
    updatedAt: null,
  },
];

const scheduleItems: CampaignScheduleItem[] = [];

beforeEach(() => {
  vi.mocked(draftCampaignStudioAi).mockReset();
});

function buildBaseProps() {
  return {
    open: true,
    onClose: vi.fn(),
    campaign,
    selectedSection: 'schedule' as const,
    readiness,
    scheduleItems,
    templates,
    milestones,
    isSaving: false,
    onCreateScheduleEvent: vi.fn().mockResolvedValue(true),
    onCreateCommunicationTemplate: vi.fn().mockResolvedValue({
      ...templates[0],
      id: 'created-template-1',
    }),
    onCreateCommunicationSchedule: vi.fn().mockResolvedValue(true),
    onSaveMilestones: vi.fn().mockResolvedValue(true),
    onTeamWorkspaceChanged: vi.fn().mockResolvedValue(undefined),
    onUpdateCampaignSettings: vi.fn().mockResolvedValue(true),
  };
}

describe('CampaignStudioAiRail', () => {
  it('shows schedule-specific prompt starters and signals', () => {
    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
      />
    );

    expect(
      screen.getByRole('button', {
        name: /add volunteer orientation, sorting, and pickup planning blocks/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/add communication timing for the key milestones/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send ai prompt/i })).toBeDisabled();
  });

  it('drafts and applies a calendar event from a prompt', async () => {
    const user = userEvent.setup();
    const onCreateScheduleEvent = vi.fn().mockResolvedValue(true);
    vi.mocked(draftCampaignStudioAi).mockResolvedValueOnce({
      message: 'I drafted 1 schedule action for Blessing Tree 2026 Demo.',
      assumptions: [],
      warnings: [],
      actions: [
        {
          id: 'draft-event-1',
          actionType: 'create_event',
          section: 'schedule',
          title: 'Create Event: Volunteer Orientation',
          summary: 'Adds Volunteer Orientation to the campaign calendar for Blessing Tree 2026 Demo.',
          status: 'ready',
          assumptions: [],
          warnings: [],
          payload: {
            title: 'Volunteer Orientation',
            eventType: 'VOLUNTEER',
            startAt: '2026-11-03T18:00',
            endAt: null,
            allDay: false,
            notes: 'Add volunteer orientation on 2026-11-03 at 6pm',
          },
          applyTarget: {
            api: 'campaign_event.create',
            method: 'POST',
          },
        },
      ],
    });

    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
        onCreateScheduleEvent={onCreateScheduleEvent}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/ask campaign ai to draft or refine schedule changes/i),
      'Add volunteer orientation on 2026-11-03 at 6pm'
    );
    await user.click(screen.getByRole('button', { name: /send ai prompt/i }));

    expect(screen.getAllByText(/i drafted 1 schedule action/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(onCreateScheduleEvent).toHaveBeenCalledWith({
      title: 'Volunteer Orientation',
      eventType: 'VOLUNTEER',
      startAt: '2026-11-03T18:00',
      endAt: null,
      allDay: false,
      notes: 'Add volunteer orientation on 2026-11-03 at 6pm',
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^apply$/i })).not.toBeInTheDocument();
    });
  });

  it('uses a compact draft-type selector with a shared description area', async () => {
    const user = userEvent.setup();

    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
      />
    );

    expect(screen.getByText(/volunteer days, sorting blocks, pickup staffing/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^communication$/i }));

    expect(screen.getByText(/emails and reminders using one of the campaign templates/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^communication$/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('shows Team glossary help and concept prompts when Team is selected', () => {
    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
        selectedSection="team"
      />
    );

    expect(screen.getByText('Team Concepts')).toBeInTheDocument();
    expect(
      screen.getByText(/campaign-level roster label such as staff, volunteer, contact, or external/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /explain what member type means in this campaign workspace/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send ai prompt/i })).toBeInTheDocument();
  });

  it('uses phase-aware readiness prompts when Readiness is selected', () => {
    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
        selectedSection="readiness"
      />
    );

    expect(
      screen.getByRole('button', { name: /tell me exactly what i need to do to unblock campaign activation/i })
    ).toBeInTheDocument();
  });

  it('drafts and applies a readiness settings fix', async () => {
    const user = userEvent.setup();
    const onUpdateCampaignSettings = vi.fn().mockResolvedValue(true);

    vi.mocked(draftCampaignStudioAi).mockResolvedValueOnce({
      message: 'I drafted 1 readiness action for Blessing Tree 2026 Demo.',
      assumptions: [],
      warnings: [],
      actions: [
        {
          id: 'draft-settings-1',
          actionType: 'update_campaign_settings',
          section: 'settings',
          title: 'Update Campaign Settings',
          summary: 'Adds missing campaign metadata needed for readiness.',
          status: 'needs_review',
          assumptions: ['Drafted a generic campaign description from the current campaign name and year.'],
          warnings: [],
          payload: {
            name: 'Blessing Tree 2026 Demo',
            year: 2026,
            description: 'Blessing Tree 2026 Demo coordinates teams, communications, and fulfillment for the 2026 campaign year.',
            status: 'ACTIVE',
            startDate: '2026-11-01',
            endDate: '2026-12-20',
          },
          applyTarget: {
            api: 'campaign.update',
            method: 'PATCH',
          },
        },
      ],
    });

    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
        selectedSection="readiness"
        onUpdateCampaignSettings={onUpdateCampaignSettings}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/ask campaign ai to explain blockers or draft a fix bundle for readiness gaps/i),
      'Fix the activation blockers for me.'
    );
    await user.click(screen.getByRole('button', { name: /send ai prompt/i }));
    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => {
      expect(onUpdateCampaignSettings).toHaveBeenCalledWith({
        name: 'Blessing Tree 2026 Demo',
        year: 2026,
        description:
          'Blessing Tree 2026 Demo coordinates teams, communications, and fulfillment for the 2026 campaign year.',
        status: 'ACTIVE',
        startDate: '2026-11-01',
        endDate: '2026-12-20',
      });
    });
  });

  it('drafts and applies a team bundle from the team section', async () => {
    const user = userEvent.setup();
    const onTeamWorkspaceChanged = vi.fn().mockResolvedValue(undefined);

    vi.mocked(draftCampaignStudioAi).mockResolvedValueOnce({
      message: 'I drafted 4 team actions for Blessing Tree 2026 Demo.',
      assumptions: [],
      warnings: [],
      actions: [
        {
          id: 'draft-team-1',
          actionType: 'create_team',
          section: 'team',
          title: 'Create Team: Warehouse Crew',
          summary: 'Creates the Warehouse Crew team in Blessing Tree 2026 Demo.',
          status: 'ready',
          assumptions: [],
          warnings: [],
          payload: {
            teamRef: 'draft-team-ref-1',
            name: 'Warehouse Crew',
            description: null,
            isActive: true,
          },
          applyTarget: {
            api: 'campaign_team.create',
            method: 'POST',
          },
        },
        {
          id: 'draft-role-1',
          actionType: 'create_team_role',
          section: 'team',
          title: 'Create Team Role: Check In',
          summary: 'Adds the Check In role to the selected team.',
          status: 'ready',
          assumptions: [],
          warnings: [],
          payload: {
            teamId: null,
            teamRef: 'draft-team-ref-1',
            roleRef: 'draft-role-ref-1',
            name: 'Check In',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          applyTarget: {
            api: 'campaign_team_role.create',
            method: 'POST',
          },
        },
        {
          id: 'draft-member-1',
          actionType: 'create_member',
          section: 'team',
          title: 'Create Member: Chris Walker',
          summary: 'Adds Chris Walker to the campaign roster.',
          status: 'ready',
          assumptions: [],
          warnings: [],
          payload: {
            memberRef: 'draft-member-ref-1',
            displayName: 'Chris Walker',
            email: null,
            phone: null,
            notes: null,
            memberType: 'volunteer',
            appAccessStatus: 'none',
            isActive: true,
          },
          applyTarget: {
            api: 'campaign_member.create',
            method: 'POST',
          },
        },
        {
          id: 'draft-assignment-1',
          actionType: 'assign_member_to_team',
          section: 'team',
          title: 'Assign Member: Chris Walker',
          summary: 'Assigns Chris Walker to Warehouse Crew as Check In.',
          status: 'ready',
          assumptions: [],
          warnings: [],
          payload: {
            teamId: null,
            teamRef: 'draft-team-ref-1',
            memberId: null,
            memberRef: 'draft-member-ref-1',
            teamRoleId: null,
            teamRoleRef: 'draft-role-ref-1',
          },
          applyTarget: {
            api: 'campaign_team_member.create',
            method: 'POST',
          },
        },
      ],
    });

    const createTeamSpy = vi.spyOn(
      await import('@/features/campaigns/api/campaignTeamWorkspaceApi'),
      'createCampaignTeam'
    ).mockResolvedValue({
      id: 'team-1',
      campaignId: 'campaign-123',
      name: 'Warehouse Crew',
      description: null,
      isActive: true,
      memberCount: 0,
      roles: [],
      memberships: [],
      createdAt: null,
      updatedAt: null,
    });
    const createRoleSpy = vi.spyOn(
      await import('@/features/campaigns/api/campaignTeamWorkspaceApi'),
      'createCampaignTeamRole'
    ).mockResolvedValue({
      id: 'role-1',
      teamId: 'team-1',
      name: 'Check In',
      description: null,
      sortOrder: 1,
      isActive: true,
      createdAt: null,
      updatedAt: null,
    });
    const createMemberSpy = vi.spyOn(
      await import('@/features/campaigns/api/campaignTeamWorkspaceApi'),
      'createCampaignMember'
    ).mockResolvedValue({
      id: 'member-1',
      campaignId: 'campaign-123',
      displayName: 'Chris Walker',
      email: null,
      phone: null,
      notes: null,
      memberType: 'volunteer',
      appUserId: null,
      appAccessStatus: 'none',
      isActive: true,
      appUser: null,
      accessRoles: [],
      teams: [],
      teamMemberships: [],
      createdAt: null,
      updatedAt: null,
    });
    const addMemberSpy = vi.spyOn(
      await import('@/features/campaigns/api/campaignTeamWorkspaceApi'),
      'addCampaignTeamMember'
    ).mockResolvedValue({
      id: 'membership-1',
      teamId: 'team-1',
      campaignMemberId: 'member-1',
      teamRoleId: 'role-1',
      teamRole: {
        id: 'role-1',
        teamId: 'team-1',
        name: 'Check In',
        description: null,
        sortOrder: 1,
        isActive: true,
        createdAt: null,
        updatedAt: null,
      },
      createdAt: null,
      updatedAt: null,
    });

    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
        selectedSection="team"
        onTeamWorkspaceChanged={onTeamWorkspaceChanged}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/ask campaign ai to build teams, team roles, and roster assignments or explain team concepts/i),
      'Set up a Warehouse Crew team with Check In and add Chris Walker to Warehouse Crew as Check In.'
    );
    await user.click(screen.getByRole('button', { name: /send ai prompt/i }));
    await user.click(screen.getByRole('button', { name: /apply all/i }));

    await waitFor(() => {
      expect(createTeamSpy).toHaveBeenCalledWith('campaign-123', {
        name: 'Warehouse Crew',
        description: null,
        isActive: true,
      });
    });
    expect(createRoleSpy).toHaveBeenCalledWith('campaign-123', 'team-1', {
      name: 'Check In',
      description: null,
      sortOrder: 1,
      isActive: true,
    });
    expect(createMemberSpy).toHaveBeenCalledWith('campaign-123', {
      displayName: 'Chris Walker',
      email: null,
      phone: null,
      notes: null,
      memberType: 'volunteer',
      appAccessStatus: 'none',
      isActive: true,
    });
    expect(addMemberSpy).toHaveBeenCalledWith('campaign-123', 'team-1', 'member-1', 'role-1');
    expect(onTeamWorkspaceChanged).toHaveBeenCalledTimes(4);

    createTeamSpy.mockRestore();
    createRoleSpy.mockRestore();
    createMemberSpy.mockRestore();
    addMemberSpy.mockRestore();
  });

  it('drafts a communication template and schedule bundle from the communications section', async () => {
    const user = userEvent.setup();
    const onCreateCommunicationTemplate = vi.fn().mockResolvedValue({
      ...templates[0],
      id: 'new-template-id',
      name: 'Volunteer Welcome',
      templateKey: 'volunteer_welcome',
    });
    const onCreateCommunicationSchedule = vi.fn().mockResolvedValue(true);

    vi.mocked(draftCampaignStudioAi).mockResolvedValueOnce({
      message: 'I drafted 2 communications actions for Blessing Tree 2026 Demo.',
      assumptions: [],
      warnings: ['This drafts a planned calendar communication only. Automated delivery is not wired yet.'],
      actions: [
        {
          id: 'draft-template-1',
          actionType: 'create_template',
          section: 'communications',
          title: 'Create Template: Volunteer Welcome',
          summary: 'Creates a volunteer email template for Blessing Tree 2026 Demo.',
          status: 'ready',
          assumptions: [],
          warnings: [],
          payload: {
            templateRef: 'draft-template-ref-1',
            templateKey: 'volunteer_welcome',
            name: 'Volunteer Welcome',
            audience: 'VOLUNTEER',
            subjectTemplate: 'Welcome to {{campaign.name}}',
            bodyTemplate: 'Hello {{volunteer.first_name}},\n\nWelcome to {{campaign.name}}.',
            isActive: true,
          },
          applyTarget: {
            api: 'communication_template.create',
            method: 'POST',
          },
        },
        {
          id: 'draft-schedule-1',
          actionType: 'create_communication_schedule',
          section: 'communications',
          title: 'Schedule Communication: Volunteer Welcome',
          summary: 'Places Volunteer Welcome at Registration Opens',
          status: 'ready',
          assumptions: [],
          warnings: ['This drafts a planned calendar communication only. Automated delivery is not wired yet.'],
          payload: {
            templateId: null,
            templateRef: 'draft-template-ref-1',
            milestoneKey: 'registration_open',
            scheduledFor: null,
            status: 'DRAFT',
            notes: 'Create a volunteer welcome template and place it on registration open.',
          },
          applyTarget: {
            api: 'campaign_communication_schedule.create',
            method: 'POST',
          },
        },
      ],
    });

    render(
      <CampaignStudioAiRail
        {...buildBaseProps()}
        selectedSection="communications"
        onCreateCommunicationTemplate={onCreateCommunicationTemplate}
        onCreateCommunicationSchedule={onCreateCommunicationSchedule}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/ask campaign ai to draft communication templates and place them on the campaign calendar/i),
      'Create a volunteer welcome template and place it on registration open.'
    );
    await user.click(screen.getByRole('button', { name: /send ai prompt/i }));
    await user.click(screen.getByRole('button', { name: /apply all/i }));

    await waitFor(() => {
      expect(onCreateCommunicationTemplate).toHaveBeenCalledWith({
        templateKey: 'volunteer_welcome',
        name: 'Volunteer Welcome',
        audience: 'VOLUNTEER',
        subjectTemplate: 'Welcome to {{campaign.name}}',
        bodyTemplate: 'Hello {{volunteer.first_name}},\n\nWelcome to {{campaign.name}}.',
        isActive: true,
      });
    });

    expect(onCreateCommunicationSchedule).toHaveBeenCalledWith({
      templateId: 'new-template-id',
      milestoneKey: 'registration_open',
      scheduledFor: null,
      status: 'DRAFT',
      notes: 'Create a volunteer welcome template and place it on registration open.',
    });
  });
});
