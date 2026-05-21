import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignStudioTeamSection } from '@/features/campaigns/ui/CampaignStudioTeamSection';
import { useCampaignTeamWorkspace } from '@/features/campaigns/model/useCampaignTeamWorkspace';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import type { CampaignTeamWorkspaceData } from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

vi.mock('@/features/campaigns/model/useCampaignTeamWorkspace', () => ({
  useCampaignTeamWorkspace: vi.fn(),
}));

const mockedUseCampaignTeamWorkspace = vi.mocked(useCampaignTeamWorkspace);

const baseAccess: CampaignAccess = {
  campaignId: 'campaign-123',
  globalAppRole: 'APP_USER',
  roleKeys: ['CAMPAIGN_MANAGER'],
  capabilities: ['campaign.view', 'campaign.admin'],
};

const baseWorkspace: CampaignTeamWorkspaceData = {
  campaignId: 'campaign-123',
  counts: {
    memberCount: 2,
    activeMemberCount: 2,
    membersWithAppAccessCount: 1,
    activeAssignmentCount: 2,
    managerCount: 1,
    teamCount: 1,
  },
  members: [
    {
      id: 'member-1',
      campaignId: 'campaign-123',
      displayName: 'Manager User',
      email: 'manager@blessingtree.test',
      phone: null,
      notes: null,
      memberType: 'staff',
      appUserId: 'user-1',
      appAccessStatus: 'active',
      isActive: true,
      appUser: {
        id: 'user-1',
        email: 'manager@blessingtree.test',
        displayName: 'Manager User',
        appRole: 'ADMIN',
        isActive: true,
      },
      accessRoles: [
        {
          id: 'role-1',
          campaignMemberId: 'member-1',
          roleKey: 'CAMPAIGN_MANAGER',
          isActive: true,
          createdAt: null,
          updatedAt: null,
        },
      ],
      teams: [{ id: 'team-1', name: 'Phone Bank', isActive: true }],
      teamMemberships: [
        {
          id: 'membership-1',
          teamId: 'team-1',
          campaignMemberId: 'member-1',
          createdAt: null,
          updatedAt: null,
        },
      ],
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'member-2',
      campaignId: 'campaign-123',
      displayName: 'Volunteer User',
      email: 'volunteer@blessingtree.test',
      phone: null,
      notes: 'Weekend pickup support',
      memberType: 'volunteer',
      appUserId: null,
      appAccessStatus: 'none',
      isActive: true,
      appUser: null,
      accessRoles: [
        {
          id: 'role-2',
          campaignMemberId: 'member-2',
          roleKey: 'GIFT_CHECKIN',
          isActive: true,
          createdAt: null,
          updatedAt: null,
        },
      ],
      teams: [{ id: 'team-1', name: 'Phone Bank', isActive: true }],
      teamMemberships: [
        {
          id: 'membership-2',
          teamId: 'team-1',
          campaignMemberId: 'member-2',
          createdAt: null,
          updatedAt: null,
        },
      ],
      createdAt: null,
      updatedAt: null,
    },
  ],
  teams: [
    {
      id: 'team-1',
      campaignId: 'campaign-123',
      name: 'Phone Bank',
      description: 'Sponsor outreach callers',
      isActive: true,
      memberCount: 2,
      memberships: [
        {
          id: 'membership-1',
          teamId: 'team-1',
          campaignMemberId: 'member-1',
          createdAt: null,
          updatedAt: null,
        },
        {
          id: 'membership-2',
          teamId: 'team-1',
          campaignMemberId: 'member-2',
          createdAt: null,
          updatedAt: null,
        },
      ],
      createdAt: null,
      updatedAt: null,
    },
  ],
  accessRoles: [],
  roleCatalog: [
    {
      roleKey: 'CAMPAIGN_MANAGER',
      label: 'Campaign Manager',
      description: 'Full campaign setup, staffing, and operations access.',
      capabilities: ['campaign.admin', 'campaign.view'],
    },
    {
      roleKey: 'GIFT_CHECKIN',
      label: 'Gift Intake Desk',
      description: 'Check in gifts and support fulfillment handling.',
      capabilities: ['campaign.gifts.check_in', 'campaign.view'],
    },
  ],
  directoryUsers: [
    {
      id: 'user-2',
      email: 'volunteer@blessingtree.test',
      displayName: 'Volunteer User',
      appRole: 'VOLUNTEER',
      isActive: true,
      assignedRoleKeys: [],
      inactiveRoleKeys: [],
    },
  ],
  filters: {
    roleKeys: ['CAMPAIGN_MANAGER', 'GIFT_CHECKIN'],
    teams: [{ id: 'team-1', name: 'Phone Bank', isActive: true, memberCount: 2 }],
    memberTypes: ['staff', 'volunteer'],
    appAccessStatuses: ['active', 'none'],
  },
};

describe('CampaignStudioTeamSection', () => {
  beforeEach(() => {
    mockedUseCampaignTeamWorkspace.mockReset();
    mockedUseCampaignTeamWorkspace.mockReturnValue({
      workspace: baseWorkspace,
      isLoading: false,
      isSaving: false,
      error: null,
      saveMessage: null,
      reload: vi.fn(),
      saveMember: vi.fn(),
      saveAccessRole: vi.fn(),
      saveTeam: vi.fn(),
      addMemberToTeam: vi.fn(),
      removeMemberFromTeam: vi.fn(),
      linkAppUser: vi.fn(),
      inviteAppAccess: vi.fn(),
      removeAppAccess: vi.fn(),
      clearSaveMessage: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders the member table and opens the person drawer from a row click', async () => {
    const user = userEvent.setup();

    render(<CampaignStudioTeamSection campaignId="campaign-123" access={baseAccess} />);

    expect(screen.getByText('People, Access, and Teams')).toBeInTheDocument();
    expect(screen.getByText('Volunteer User')).toBeInTheDocument();
    expect(screen.getAllByText('Gift Intake Desk').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /volunteer user/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/track campaign people/i)).toBeInTheDocument();
    expect(
      screen.getByText(/team setup and membership changes are managed from the team workspace/i)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Volunteer User')).toBeInTheDocument();
  });

  it('filters the roster table by search term', async () => {
    const user = userEvent.setup();

    render(<CampaignStudioTeamSection campaignId="campaign-123" access={baseAccess} />);

    await user.type(screen.getByPlaceholderText(/search name or email/i), 'volunteer');

    expect(screen.getByText('Volunteer User')).toBeInTheDocument();
    expect(screen.queryByText('Manager User')).not.toBeInTheDocument();
  });

  it('sorts the people table when a header is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CampaignStudioTeamSection campaignId="campaign-123" access={baseAccess} />
    );

    const tables = container.querySelectorAll('table');
    const peopleTable = tables[0];
    const getPeopleRows = () => Array.from(peopleTable.querySelectorAll('tbody tr'));

    expect(getPeopleRows()[0]?.textContent).toContain('Manager User');

    await user.click(within(peopleTable).getByRole('button', { name: /person/i }));

    expect(getPeopleRows()[0]?.textContent).toContain('Volunteer User');
  });

  it('renders a separate Teams table and opens the team drawer from a team row', async () => {
    const user = userEvent.setup();

    render(<CampaignStudioTeamSection campaignId="campaign-123" access={baseAccess} />);

    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument();

    const teamButtons = screen.getAllByRole('button', { name: /phone bank/i });

    await user.click(teamButtons[teamButtons.length - 1]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/configure the team first, then manage who belongs to it/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Phone Bank')).toBeInTheDocument();
  });

  it('hides management actions without campaign admin capability', () => {
    render(
      <CampaignStudioTeamSection
        campaignId="campaign-123"
        access={{ ...baseAccess, capabilities: ['campaign.view'] }}
      />
    );

    expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add team/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Phone Bank').length).toBeGreaterThan(0);
  });

  it('shows inline Team glossary help inside the person drawer', async () => {
    const user = userEvent.setup();

    render(<CampaignStudioTeamSection campaignId="campaign-123" access={baseAccess} />);

    expect(
      screen.queryByText(/campaign-level roster label such as staff, volunteer, contact, or external/i)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /volunteer user/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getAllByRole('button', { name: /help: member type/i })[0]);

    expect(
      screen.getAllByText(/campaign-level roster label such as staff, volunteer, contact, or external/i)
        .length
    ).toBeGreaterThan(0);
  });
});
