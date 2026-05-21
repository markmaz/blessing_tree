import { useMemo, useState } from 'react';
import { getCampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import type {
  CampaignTeamRole,
  CampaignTeamRoleUpsertInput,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

interface CampaignStudioTeamTeamRolesSectionProps {
  teamId: string;
  roles: CampaignTeamRole[];
  canManageTeam: boolean;
  isSaving: boolean;
  onSaveRole: (
    teamId: string,
    input: CampaignTeamRoleUpsertInput,
    roleId?: string
  ) => Promise<boolean>;
}

const emptyRoleForm: CampaignTeamRoleUpsertInput = {
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
};

export function CampaignStudioTeamTeamRolesSection({
  teamId,
  roles,
  canManageTeam,
  isSaving,
  onSaveRole,
}: CampaignStudioTeamTeamRolesSectionProps) {
  const teamRolesHelp = getCampaignTeamGlossaryEntry('team_roles');
  const sortedRoles = useMemo(
    () =>
      [...roles].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.name.localeCompare(right.name);
      }),
    [roles]
  );
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CampaignTeamRoleUpsertInput>(emptyRoleForm);

  const handleSaveRole = async () => {
    const didSave = await onSaveRole(teamId, formState, editingRoleId ?? undefined);
    if (!didSave) {
      return;
    }
    setEditingRoleId(null);
    setFormState(emptyRoleForm);
  };

  return (
    <section className="campaign-team-drawer__section">
      <div className="campaign-team-drawer__section-header">
        <div>
          <h4 className="h6 mb-1">
            Team Roles
            <InlineHelpPopover
              title={teamRolesHelp.label}
              body={teamRolesHelp.description}
            />
          </h4>
          <p className="text-muted mb-0">
            Define operational responsibilities inside this team. Leave a person on plain
            <strong> Member</strong> status if the team itself is enough.
          </p>
        </div>
      </div>

      <div className="campaign-team-role-form">
        <label className="form-label campaign-team-role-form__name">
          Role Name
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
        <label className="form-label">
          Sort Order
          <input
            className="form-control"
            type="number"
            value={formState.sortOrder ?? 0}
            disabled={!canManageTeam || isSaving}
            onChange={(event) =>
              setFormState((currentState) => ({
                ...currentState,
                sortOrder: Number(event.target.value || 0),
              }))
            }
          />
        </label>
        <label className="form-label campaign-team-role-form__description">
          Role Description
          <input
            className="form-control"
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
          <span>Role is active</span>
        </label>
        <div className="campaign-team-drawer__action-row">
          {editingRoleId ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setEditingRoleId(null);
                setFormState(emptyRoleForm);
              }}
            >
              <i className="bi bi-x-circle me-2" aria-hidden="true" />
              Cancel Edit
            </button>
          ) : null}
          {canManageTeam ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isSaving}
              onClick={() => {
                void handleSaveRole();
              }}
            >
              <i
                className={`bi ${editingRoleId ? 'bi-floppy' : 'bi-plus-circle'} me-2`}
                aria-hidden="true"
              />
              {editingRoleId ? 'Save Role' : 'Add Role'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="campaign-team-inline-list">
        {sortedRoles.length === 0 ? (
          <div className="campaign-studio__empty-note">
            No team roles yet. People can still join this team as plain members.
          </div>
        ) : (
          sortedRoles.map((role) => (
            <article key={role.id} className="campaign-team-inline-item">
              <div className="campaign-team-inline-item__content">
                <strong>{role.name}</strong>
                <div className="small text-muted">
                  {role.description?.trim() || 'No description yet'}
                </div>
                <div className="campaign-team-inline-meta">
                  <span className="campaign-chip campaign-chip-muted">
                    {role.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="campaign-chip campaign-chip-muted">
                    Sort {role.sortOrder}
                  </span>
                </div>
              </div>
              {canManageTeam ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={isSaving}
                  onClick={() => {
                    setEditingRoleId(role.id);
                    setFormState({
                      name: role.name,
                      description: role.description ?? '',
                      sortOrder: role.sortOrder,
                      isActive: role.isActive,
                    });
                  }}
                >
                  <i className="bi bi-pencil-square me-2" aria-hidden="true" />
                  Edit Role
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
