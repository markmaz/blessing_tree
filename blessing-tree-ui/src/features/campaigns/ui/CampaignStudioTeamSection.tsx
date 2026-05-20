import { useState } from 'react';
import { listCampaignDirectoryUsers } from '@/features/campaigns/api/campaignStudioTeamApi';
import { campaignRoleOptions } from '@/features/campaigns/model/campaignStudio';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type {
  CampaignAssignment,
  CampaignDirectoryUser,
  CampaignTeamSnapshot,
  CreateCampaignAssignmentInput,
} from '@/features/campaigns/model/campaignStudioTypes';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';

interface CampaignStudioTeamSectionProps {
  campaignId: string;
  access: CampaignAccess;
  team: CampaignTeamSnapshot;
  isSaving: boolean;
  onAddAssignment: (input: CreateCampaignAssignmentInput) => Promise<boolean>;
}

export function CampaignStudioTeamSection({
  campaignId,
  access,
  team,
  isSaving,
  onAddAssignment,
}: CampaignStudioTeamSectionProps) {
  const activeAssignments = team.assignments.filter((assignment) => assignment.isActive);
  const canEditTeam = canManageCampaign(access);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>(
    campaignRoleOptions[0]?.key ?? 'CAMPAIGN_MANAGER'
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [directoryUsers, setDirectoryUsers] = useState<CampaignDirectoryUser[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const users = await listCampaignDirectoryUsers(campaignId, searchTerm, 8);
      setDirectoryUsers(users);
    } catch (searchUsersError) {
      setDirectoryUsers([]);
      setSearchError(
        searchUsersError instanceof Error
          ? searchUsersError.message
          : 'Unable to search users'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAssignment = async (user: CampaignDirectoryUser) => {
    const didSave = await onAddAssignment({
      userId: user.id,
      roleKey: selectedRoleKey,
      isActive: true,
    });

    if (!didSave) {
      return;
    }

    try {
      const users = await listCampaignDirectoryUsers(campaignId, searchTerm, 8);
      setDirectoryUsers(users);
    } catch {
      setDirectoryUsers([]);
    }
  };

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Team"
        title="Campaign Operators"
        description="See the active operating team, then add managers, coordinators, and volunteers from the campaign user directory."
      >
        <div className="campaign-studio__stat-grid">
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Managers</span>
            <strong>{team.counts.managerCount}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Active Assignments</span>
            <strong>{team.counts.activeAssignmentCount}</strong>
          </div>
          <div className="campaign-studio__stat-card">
            <span className="campaign-studio__stat-label">Unique Members</span>
            <strong>{team.counts.memberCount}</strong>
          </div>
        </div>

        <div className="campaign-studio__section-grid mt-4">
          <div className="campaign-studio__list-column">
            <h3 className="h6 mb-3">Active Assignments</h3>
            <div className="campaign-studio__section-list">
              {activeAssignments.length === 0 ? (
                <div className="campaign-studio__empty-note">
                  No active campaign assignments yet.
                </div>
              ) : (
                activeAssignments.map((assignment) => (
                  <ActiveAssignmentCard key={assignment.id} assignment={assignment} />
                ))
              )}
            </div>
          </div>

          <div className="campaign-studio__list-column">
            <h3 className="h6 mb-3">Add Team Members</h3>
            {canEditTeam ? (
              <>
                <form className="campaign-studio__form-grid" onSubmit={handleSearch}>
                  <label className="form-label campaign-studio__form-span-2">
                    Search by Name or Email
                    <input
                      className="form-control"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search active users"
                    />
                  </label>
                  <label className="form-label campaign-studio__form-span-2">
                    Role to Assign
                    <select
                      className="form-select"
                      value={selectedRoleKey}
                      onChange={(event) => setSelectedRoleKey(event.target.value)}
                    >
                      {campaignRoleOptions.map((role) => (
                        <option key={role.key} value={role.key}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">
                      {
                        campaignRoleOptions.find((role) => role.key === selectedRoleKey)
                          ?.description
                      }
                    </div>
                  </label>
                  <div className="campaign-studio__form-actions">
                    <button
                      type="submit"
                      className="btn btn-secondary btn-sm"
                      disabled={isSearching}
                    >
                      {isSearching ? 'Searching...' : 'Search Directory'}
                    </button>
                  </div>
                </form>

                {searchError ? (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    {searchError}
                  </div>
                ) : null}

                <div className="campaign-studio__section-list mt-3">
                  {!hasSearched ? (
                    <div className="campaign-studio__inline-note">
                      Search the app users directory to add campaign managers, data entry operators, or volunteers.
                    </div>
                  ) : directoryUsers.length === 0 ? (
                    <div className="campaign-studio__empty-note">
                      No active users matched that search.
                    </div>
                  ) : (
                    directoryUsers.map((user) => (
                      <DirectoryUserCard
                        key={user.id}
                        user={user}
                        selectedRoleKey={selectedRoleKey}
                        isSaving={isSaving}
                        onAddAssignment={handleAddAssignment}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="campaign-studio__empty-note">
                Team assignment changes require the <code>campaign.admin</code> capability.
              </div>
            )}
          </div>
        </div>
      </CampaignStudioSectionCard>
    </div>
  );
}

function ActiveAssignmentCard({ assignment }: { assignment: CampaignAssignment }) {
  return (
    <article className="campaign-studio__list-card">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
        <div>
          <h4 className="h6 mb-1">{assignment.user.displayName}</h4>
          <div className="small text-muted">{assignment.user.email}</div>
        </div>
        <div className="campaign-chip-row">
          <span className="campaign-chip">{toRoleLabel(assignment.roleKey)}</span>
          <span className="campaign-chip campaign-chip-muted">
            {assignment.user.appRole}
          </span>
        </div>
      </div>
    </article>
  );
}

function DirectoryUserCard({
  user,
  selectedRoleKey,
  isSaving,
  onAddAssignment,
}: {
  user: CampaignDirectoryUser;
  selectedRoleKey: string;
  isSaving: boolean;
  onAddAssignment: (user: CampaignDirectoryUser) => Promise<void>;
}) {
  const alreadyAssigned = user.assignedRoleKeys.includes(selectedRoleKey);

  return (
    <article className="campaign-studio__list-card">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div className="campaign-studio__directory-user">
          <h4 className="h6 mb-1">{user.displayName}</h4>
          <div className="small text-muted">{user.email}</div>
          <div className="campaign-chip-row mt-2">
            <span className="campaign-chip campaign-chip-muted">{user.appRole}</span>
            {user.assignedRoleKeys.map((roleKey) => (
              <span key={roleKey} className="campaign-chip">
                {toRoleLabel(roleKey)}
              </span>
            ))}
            {user.inactiveRoleKeys.map((roleKey) => (
              <span key={roleKey} className="campaign-chip campaign-chip-muted">
                {toRoleLabel(roleKey)} inactive
              </span>
            ))}
          </div>
        </div>
        <div className="campaign-studio__directory-actions">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={alreadyAssigned || isSaving}
            onClick={() => void onAddAssignment(user)}
          >
            {alreadyAssigned ? 'Already Assigned' : `Add as ${toRoleLabel(selectedRoleKey)}`}
          </button>
        </div>
      </div>
    </article>
  );
}

function toRoleLabel(roleKey: string): string {
  return (
    campaignRoleOptions.find((role) => role.key === roleKey)?.label ??
    roleKey
      .toLowerCase()
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  );
}
