import { useMemo, useState } from 'react';
import { getCampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import type {
  CampaignTeamUpsertInput,
  CampaignTeamWorkspaceMember,
  CampaignTeamWorkspaceTeam,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { InlineConfirmAction } from '@/shared/ui/InlineConfirmAction';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

interface CampaignStudioTeamTeamDrawerProps {
  isOpen: boolean;
  isSaving: boolean;
  team: CampaignTeamWorkspaceTeam | null;
  members: CampaignTeamWorkspaceMember[];
  canManageTeam: boolean;
  onClose: () => void;
  onSave: (input: CampaignTeamUpsertInput, teamId?: string) => Promise<boolean>;
  onAddMember: (teamId: string, memberId: string) => Promise<boolean>;
  onRemoveMember: (teamId: string, memberId: string) => Promise<boolean>;
}

const emptyTeamForm: CampaignTeamUpsertInput = {
  name: '',
  description: '',
  isActive: true,
};

export function CampaignStudioTeamTeamDrawer({
  isOpen,
  isSaving,
  team,
  members,
  canManageTeam,
  onClose,
  onSave,
  onAddMember,
  onRemoveMember,
}: CampaignStudioTeamTeamDrawerProps) {
  const teamsHelp = getCampaignTeamGlossaryEntry('teams');
  const [formState, setFormState] = useState<CampaignTeamUpsertInput>(
    team
      ? {
          name: team.name,
          description: team.description ?? '',
          isActive: team.isActive,
        }
      : emptyTeamForm
  );
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const teamMembers = useMemo(() => {
    if (!team) {
      return [];
    }

    const membershipIds = new Set(team.memberships.map((membership) => membership.campaignMemberId));
    return members
      .filter((member) => membershipIds.has(member.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [members, team]);

  const availableMembers = useMemo(() => {
    if (!team) {
      return members.filter((member) => member.isActive);
    }

    const membershipIds = new Set(team.memberships.map((membership) => membership.campaignMemberId));
    return members
      .filter((member) => member.isActive && !membershipIds.has(member.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [members, team]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const didSave = await onSave(formState, team?.id);
    if (didSave) {
      onClose();
    }
  };

  return (
    <CampaignStudioDrawer
      isOpen={isOpen}
      title={team ? team.name : 'Add Team'}
      description="Configure the team first, then manage who belongs to it in one focused workflow."
      onClose={onClose}
    >
      <form className="campaign-team-drawer__stack" onSubmit={handleSubmit}>
        <section className="campaign-team-drawer__section">
          <div className="campaign-team-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">Team Setup</h4>
              <p className="text-muted mb-0">
                Define the team itself here before changing who belongs to it.
              </p>
            </div>
          </div>
          <div className="campaign-team-form-grid">
            <label className="form-label campaign-team-form-grid__span-2">
              Team Name
              <input
                className="form-control"
                value={formState.name}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-label campaign-team-form-grid__span-2">
              Description
              <textarea
                className="form-control"
                rows={3}
                value={formState.description ?? ''}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="campaign-team-checkbox">
              <input
                type="checkbox"
                checked={formState.isActive ?? true}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    isActive: event.target.checked,
                  }))
                }
              />
              <span>Team is active</span>
            </label>
          </div>
        </section>

        {team ? (
          <section className="campaign-team-drawer__section">
            <div className="campaign-team-drawer__section-header">
              <div>
                <h4 className="h6 mb-1">
                  Membership Management
                  <InlineHelpPopover title={teamsHelp.label} body={teamsHelp.description} />
                </h4>
                <p className="text-muted mb-0">
                  Add or remove campaign people from this team here so membership changes stay
                  attached to team management.
                </p>
              </div>
            </div>

            {canManageTeam ? (
              <div className="campaign-team-add-inline">
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
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!selectedMemberId || isSaving}
                  onClick={async () => {
                    const didSave = await onAddMember(team.id, selectedMemberId);
                    if (didSave) {
                      setSelectedMemberId('');
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
                teamMembers.map((member) => (
                  <article key={member.id} className="campaign-team-inline-item">
                    <div>
                      <strong>{member.displayName}</strong>
                      <div className="small text-muted">{member.email ?? 'No email yet'}</div>
                    </div>
                    {canManageTeam ? (
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
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        <div className="campaign-team-drawer__actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          {canManageTeam ? (
            <button type="submit" className="btn btn-secondary" disabled={isSaving}>
              {isSaving ? 'Saving...' : team ? 'Save Team' : 'Create Team'}
            </button>
          ) : null}
        </div>
      </form>
    </CampaignStudioDrawer>
  );
}
