import { getCampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import {
  getCampaignRoleDescription,
  toCampaignRoleLabel,
} from '@/features/campaigns/model/campaignTeamWorkspacePresentation';
import type {
  CampaignRoleCatalogEntry,
  CampaignTeamWorkspaceMember,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

interface CampaignStudioTeamMemberAccessRolesSectionProps {
  member: CampaignTeamWorkspaceMember;
  roleCatalog: CampaignRoleCatalogEntry[];
  canManageTeam: boolean;
  isSaving: boolean;
  selectedRoleKey: string;
  onSelectRoleKey: (roleKey: string) => void;
  onSaveAccessRole: (
    memberId: string,
    input: { roleKey: string; isActive?: boolean },
    assignmentId?: string
  ) => Promise<boolean>;
}

export function CampaignStudioTeamMemberAccessRolesSection({
  member,
  roleCatalog,
  canManageTeam,
  isSaving,
  selectedRoleKey,
  onSelectRoleKey,
  onSaveAccessRole,
}: CampaignStudioTeamMemberAccessRolesSectionProps) {
  const accessRolesHelp = getCampaignTeamGlossaryEntry('app_access_roles');
  return (
    <section className="campaign-team-drawer__section">
      <div className="campaign-team-drawer__section-header">
        <div>
          <h4 className="h6 mb-1">
            App Access Roles
            <InlineHelpPopover
              title={accessRolesHelp.label}
              body={accessRolesHelp.description}
            />
          </h4>
          <p className="text-muted mb-0">
            Access roles are fixed permission bundles. Use teams for custom communication groups.
          </p>
        </div>
      </div>

      <div className="campaign-team-add-inline">
        <select
          className="form-select"
          value={selectedRoleKey}
          disabled={!canManageTeam || isSaving}
          onChange={(event) => onSelectRoleKey(event.target.value)}
        >
          {roleCatalog.map((role) => (
            <option key={role.roleKey} value={role.roleKey}>
              {role.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!canManageTeam || !selectedRoleKey || isSaving}
          onClick={() =>
            void onSaveAccessRole(member.id, {
              roleKey: selectedRoleKey,
              isActive: true,
            })
          }
        >
          <i className="bi bi-shield-plus me-2" aria-hidden="true" />
          Add Role
        </button>
      </div>
      <div className="form-text mb-3">
        {getCampaignRoleDescription(selectedRoleKey, roleCatalog)}
      </div>

      <div className="campaign-team-inline-list">
        {member.accessRoles.length === 0 ? (
          <div className="campaign-studio__empty-note">No access roles yet.</div>
        ) : (
          member.accessRoles.map((assignment) => (
            <article key={assignment.id} className="campaign-team-inline-item">
              <div>
                <strong>{toCampaignRoleLabel(assignment.roleKey, roleCatalog)}</strong>
                <div className="small text-muted">
                  {assignment.isActive ? 'Active assignment' : 'Inactive assignment'}
                </div>
              </div>
              {canManageTeam ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={isSaving}
                  onClick={() =>
                    void onSaveAccessRole(
                      member.id,
                      {
                        roleKey: assignment.roleKey,
                        isActive: !assignment.isActive,
                      },
                      assignment.id
                    )
                  }
                >
                  <i
                    className={`bi ${assignment.isActive ? 'bi-shield-x' : 'bi-shield-check'} me-2`}
                    aria-hidden="true"
                  />
                  {assignment.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
