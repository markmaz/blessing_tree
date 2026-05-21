import { campaignRoleOptions } from '@/features/campaigns/model/campaignStudio';
import {
  getCampaignRoleDescription,
  toCampaignRoleLabel,
} from '@/features/campaigns/model/campaignTeamWorkspacePresentation';
import type { CampaignTeamWorkspaceMember } from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

interface CampaignStudioTeamMemberAccessRolesSectionProps {
  member: CampaignTeamWorkspaceMember;
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
  canManageTeam,
  isSaving,
  selectedRoleKey,
  onSelectRoleKey,
  onSaveAccessRole,
}: CampaignStudioTeamMemberAccessRolesSectionProps) {
  return (
    <section className="campaign-team-drawer__section">
      <div className="campaign-team-drawer__section-header">
        <div>
          <h4 className="h6 mb-1">Access Roles</h4>
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
          {campaignRoleOptions.map((role) => (
            <option key={role.key} value={role.key}>
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
          Add Role
        </button>
      </div>
      <div className="form-text mb-3">{getCampaignRoleDescription(selectedRoleKey)}</div>

      <div className="campaign-team-inline-list">
        {member.accessRoles.length === 0 ? (
          <div className="campaign-studio__empty-note">No access roles yet.</div>
        ) : (
          member.accessRoles.map((assignment) => (
            <article key={assignment.id} className="campaign-team-inline-item">
              <div>
                <strong>{toCampaignRoleLabel(assignment.roleKey)}</strong>
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
