import { useState } from 'react';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import type {
  CampaignTeamUpsertInput,
  CampaignTeamWorkspaceMember,
  CampaignTeamWorkspaceTeam,
  CampaignTeamRoleUpsertInput,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { CampaignStudioTeamMembershipSection } from '@/features/campaigns/ui/CampaignStudioTeamMembershipSection';
import { CampaignStudioTeamTeamRolesSection } from '@/features/campaigns/ui/CampaignStudioTeamTeamRolesSection';

interface CampaignStudioTeamTeamDrawerProps {
  isOpen: boolean;
  isSaving: boolean;
  team: CampaignTeamWorkspaceTeam | null;
  members: CampaignTeamWorkspaceMember[];
  canManageTeam: boolean;
  onClose: () => void;
  onSave: (input: CampaignTeamUpsertInput, teamId?: string) => Promise<boolean>;
  onSaveRole: (
    teamId: string,
    input: CampaignTeamRoleUpsertInput,
    roleId?: string
  ) => Promise<boolean>;
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
  onSaveRole,
  onAddMember,
  onUpdateMemberRole,
  onRemoveMember,
}: CampaignStudioTeamTeamDrawerProps) {
  const [formState, setFormState] = useState<CampaignTeamUpsertInput>(
    team
      ? {
          name: team.name,
          description: team.description ?? '',
          isActive: team.isActive,
        }
      : emptyTeamForm
  );

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
          <>
            <CampaignStudioTeamTeamRolesSection
              teamId={team.id}
              roles={team.roles}
              canManageTeam={canManageTeam}
              isSaving={isSaving}
              onSaveRole={onSaveRole}
            />

            <CampaignStudioTeamMembershipSection
              team={team}
              members={members}
              roles={team.roles}
              canManageTeam={canManageTeam}
              isSaving={isSaving}
              onAddMember={onAddMember}
              onUpdateMemberRole={onUpdateMemberRole}
              onRemoveMember={onRemoveMember}
            />
          </>
        ) : null}

        <div className="campaign-team-drawer__actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Cancel
          </button>
          {canManageTeam ? (
            <button type="submit" className="btn btn-secondary" disabled={isSaving}>
              <i
                className={`bi ${isSaving ? 'bi-arrow-repeat' : team ? 'bi-floppy' : 'bi-people-fill'} me-2`}
                aria-hidden="true"
              />
              {isSaving ? 'Saving...' : team ? 'Save Team' : 'Create Team'}
            </button>
          ) : null}
        </div>
      </form>
    </CampaignStudioDrawer>
  );
}
