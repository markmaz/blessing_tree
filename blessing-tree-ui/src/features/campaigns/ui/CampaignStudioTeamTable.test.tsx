import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignStudioTeamTable } from '@/features/campaigns/ui/CampaignStudioTeamTable';
import type { CampaignTeamWorkspaceMember } from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

const members: CampaignTeamWorkspaceMember[] = [
  {
    id: 'member-1',
    campaignId: 'campaign-1',
    displayName: 'Alex Volunteer',
    email: 'alex@blessingtree.test',
    phone: null,
    notes: null,
    memberType: 'volunteer',
    appUserId: null,
    appAccessStatus: 'none',
    isActive: true,
    appUser: null,
    accessRoles: [],
    teams: [
      {
        id: 'team-1',
        name: 'Warehouse Crew',
        isActive: true,
        teamRoleId: 'team-role-1',
        teamRoleName: 'Lead',
      },
      {
        id: 'team-2',
        name: 'Sponsor Callers',
        isActive: true,
        teamRoleId: 'team-role-2',
        teamRoleName: 'Caller',
      },
      {
        id: 'team-3',
        name: 'Pickup Weekend',
        isActive: true,
        teamRoleId: null,
        teamRoleName: null,
      },
    ],
    teamMemberships: [
      {
        id: 'membership-1',
        teamId: 'team-1',
        campaignMemberId: 'member-1',
        teamRoleId: 'team-role-1',
        teamRole: {
          id: 'team-role-1',
          teamId: 'team-1',
          name: 'Lead',
          description: 'Coordinates the team.',
          sortOrder: 1,
          isActive: true,
          createdAt: null,
          updatedAt: null,
        },
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'membership-2',
        teamId: 'team-2',
        campaignMemberId: 'member-1',
        teamRoleId: 'team-role-2',
        teamRole: {
          id: 'team-role-2',
          teamId: 'team-2',
          name: 'Caller',
          description: 'Calls sponsors.',
          sortOrder: 2,
          isActive: true,
          createdAt: null,
          updatedAt: null,
        },
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'membership-3',
        teamId: 'team-3',
        campaignMemberId: 'member-1',
        teamRoleId: null,
        teamRole: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
    createdAt: null,
    updatedAt: null,
  },
];

describe('CampaignStudioTeamTable', () => {
  it('shows team roles in the roles column, including implicit member participation', () => {
    render(<CampaignStudioTeamTable members={members} onSelectMember={vi.fn()} />);

    const row = screen.getByRole('button', { name: /alex volunteer/i });

    expect(within(row).getByText('Lead')).toBeInTheDocument();
    expect(within(row).getByText('Caller')).toBeInTheDocument();
    expect(within(row).getByText('Member')).toBeInTheDocument();
    expect(within(row).queryByText(/no access roles/i)).not.toBeInTheDocument();
  });
});
