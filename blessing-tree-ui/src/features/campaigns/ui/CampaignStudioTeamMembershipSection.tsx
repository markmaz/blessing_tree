import { useMemo, useState } from 'react';
import { getCampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import type {
  CampaignTeamRole,
  CampaignTeamWorkspaceMember,
  CampaignTeamWorkspaceTeam,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { InlineConfirmAction } from '@/shared/ui/InlineConfirmAction';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

interface CampaignStudioTeamMembershipSectionProps {
  team: CampaignTeamWorkspaceTeam;
  members: CampaignTeamWorkspaceMember[];
  roles: CampaignTeamRole[];
  canManageTeam: boolean;
  isSaving: boolean;
  onAddMember: (
    teamId: string,
    memberId: string,
    teamRoleId?: string | null
  ) => Promise<boolean>;
  onUpdateMemberRole: (
    teamId: string,
    memberId: string,
    teamRoleId: string | null
  ) => Promise<boolean>;
  onRemoveMember: (teamId: string, memberId: string) => Promise<boolean>;
}

export function CampaignStudioTeamMembershipSection({
  team,
  members,
  roles,
  canManageTeam,
  isSaving,
  onAddMember,
  onUpdateMemberRole,
  onRemoveMember,
}: CampaignStudioTeamMembershipSectionProps) {
  const teamsHelp = getCampaignTeamGlossaryEntry('teams');
  const availableRoles = useMemo(
    () => roles.filter((role) => role.isActive),
    [roles]
  );
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const teamMembers = useMemo(() => {
    const membershipIds = new Set(team.memberships.map((membership) => membership.campaignMemberId));
    return members
      .filter((member) => membershipIds.has(member.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [members, team.memberships]);

  const availableMembers = useMemo(() => {
    const membershipIds = new Set(team.memberships.map((membership) => membership.campaignMemberId));
    return members
      .filter((member) => member.isActive && !membershipIds.has(member.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [members, team.memberships]);

  return (
    <section className="campaign-team-drawer__section">
      <div className="campaign-team-drawer__section-header">
        <div>
          <h4 className="h6 mb-1">
            Membership Management
            <InlineHelpPopover title={teamsHelp.label} body={teamsHelp.description} />
          </h4>
          <p className="text-muted mb-0">
            Add people to this team and optionally give them a team role. Leaving the role blank
            keeps them as a plain member.
          </p>
        </div>
      </div>

      {canManageTeam ? (
        <div className="campaign-team-add-inline campaign-team-add-inline--stacked">
          <select
            className="form-select"
            value={selectedMemberId}
            disabled={isSaving}
            onChange={(event) => setSelectedMemberId(event.target.value)}
          >
            <option value="">Select a campaign person</option>
            {availableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
                {member.email ? ` · ${member.email}` : ''}
              </option>
            ))}
          </select>
          <select
            className="form-select"
            value={selectedRoleId}
            disabled={isSaving}
            onChange={(event) => setSelectedRoleId(event.target.value)}
          >
            <option value="">Member</option>
            {availableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!selectedMemberId || isSaving}
            onClick={async () => {
              const didSave = await onAddMember(
                team.id,
                selectedMemberId,
                selectedRoleId || null
              );
              if (didSave) {
                setSelectedMemberId('');
                setSelectedRoleId('');
              }
            }}
          >
            Add Member
          </button>
        </div>
      ) : null}

      <div className="campaign-team-inline-list">
        {teamMembers.length === 0 ? (
          <div className="campaign-studio__empty-note">No members on this team yet.</div>
        ) : (
          teamMembers.map((member) => {
            const membership = team.memberships.find(
              (item) => item.campaignMemberId === member.id
            );
            const activeRoleId = membership?.teamRoleId ?? '';
            return (
              <article key={member.id} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                <div className="campaign-team-inline-item__content">
                  <strong>{member.displayName}</strong>
                  <div className="small text-muted">{member.email ?? 'No email yet'}</div>
                  <div className="campaign-team-inline-meta">
                    <span className="campaign-chip campaign-chip-muted">
                      {membership?.teamRole?.name ?? 'Member'}
                    </span>
                  </div>
                </div>
                {canManageTeam ? (
                  <div className="campaign-team-inline-item__actions">
                    <select
                      className="form-select form-select-sm"
                      value={activeRoleId}
                      disabled={isSaving}
                      onChange={async (event) => {
                        await onUpdateMemberRole(
                          team.id,
                          member.id,
                          event.target.value || null
                        );
                      }}
                    >
                      <option value="">Member</option>
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <InlineConfirmAction
                      buttonLabel="Remove"
                      confirmLabel="Remove from Team"
                      cancelLabel="Cancel"
                      message={`Remove ${member.displayName} from ${team.name}?`}
                      tone="secondary"
                      disabled={isSaving}
                      onConfirm={async () => {
                        await onRemoveMember(team.id, member.id);
                      }}
                    />
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
