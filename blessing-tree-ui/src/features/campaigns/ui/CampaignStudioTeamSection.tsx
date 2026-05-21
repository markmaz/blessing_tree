import { useEffect, useMemo, useState } from 'react';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import { useCampaignTeamWorkspace } from '@/features/campaigns/model/useCampaignTeamWorkspace';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import {
  CampaignStudioTeamToolbar,
  type CampaignStudioTeamSearchState,
} from '@/features/campaigns/ui/CampaignStudioTeamToolbar';
import { CampaignStudioTeamListTable } from '@/features/campaigns/ui/CampaignStudioTeamListTable';
import { CampaignStudioTeamTable } from '@/features/campaigns/ui/CampaignStudioTeamTable';
import { CampaignStudioTeamMemberDrawer } from '@/features/campaigns/ui/CampaignStudioTeamMemberDrawer';
import { CampaignStudioTeamTeamDrawer } from '@/features/campaigns/ui/CampaignStudioTeamTeamDrawer';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';

interface CampaignStudioTeamSectionProps {
  campaignId: string;
  access: CampaignAccess;
  refreshToken?: number;
}

const defaultPeopleSearch: CampaignStudioTeamSearchState = {
  search: '',
};

const defaultTeamSearch: CampaignStudioTeamSearchState = {
  search: '',
};

export function CampaignStudioTeamSection({
  campaignId,
  access,
  refreshToken = 0,
}: CampaignStudioTeamSectionProps) {
  const canManageTeam = canManageCampaign(access);
  const {
    workspace,
    isLoading,
    isSaving,
    error,
    saveMessage,
    saveMember,
    saveAccessRole,
    saveTeam,
    addMemberToTeam,
    removeMemberFromTeam,
    linkAppUser,
    inviteAppAccess,
    removeAppAccess,
    clearSaveMessage,
    clearError,
    saveTeamRole,
    updateMemberTeamRole,
    reload,
  } = useCampaignTeamWorkspace(campaignId);
  const [peopleSearch, setPeopleSearch] = useState<CampaignStudioTeamSearchState>(
    defaultPeopleSearch
  );
  const [teamSearchState, setTeamSearchState] =
    useState<CampaignStudioTeamSearchState>(defaultTeamSearch);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isCreateMemberOpen, setIsCreateMemberOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  useEffect(() => {
    if (refreshToken <= 0) {
      return;
    }

    void reload();
  }, [refreshToken, reload]);

  const filteredMembers = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = peopleSearch.search.trim().toLowerCase();

    return workspace.members
      .filter((member) => {
        if (normalizedSearch) {
          const haystack = `${member.displayName} ${member.email ?? ''}`.toLowerCase();
          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }
        return true;
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [peopleSearch, workspace]);

  const selectedMember = findById(workspace?.members, selectedMemberId);
  const selectedTeam = findById(workspace?.teams, selectedTeamId);
  const filteredTeams = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = teamSearchState.search.trim().toLowerCase();

    return workspace.teams
      .filter((team) => {
        if (!normalizedSearch) {
          return true;
        }

        const haystack = `${team.name} ${team.description ?? ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [teamSearchState, workspace]);

  return (
    <div className="campaign-studio__canvas-stack">
      <CampaignStudioSectionCard
        eyebrow="Team"
        title="People, Access, and Teams"
        description="Manage the campaign roster, fixed access roles, and custom operational teams from one workspace."
      >
        {saveMessage ? (
          <AutoDismissAlert
            key={saveMessage}
            message={saveMessage}
            onDismiss={clearSaveMessage}
          />
        ) : null}
        {error ? (
          <div className="alert alert-danger" role="alert">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={clearError}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {isLoading || !workspace ? (
          <p className="text-muted mb-0">Loading team workspace...</p>
        ) : (
          <>
            <div className="campaign-studio__stat-grid campaign-team-stats">
              <StatCard label="Active Assignments" value={workspace.counts.activeAssignmentCount} />
              <StatCard label="Teams" value={workspace.counts.teamCount} />
              <StatCard label="Roster Total" value={workspace.counts.memberCount} />
            </div>

            <div className="campaign-team-workspace">
              <section className="campaign-team-workspace__section">
                <div className="campaign-team-workspace__section-header">
                  <div>
                    <h3 className="h5 mb-1">People</h3>
                    <p className="text-muted mb-0">
                      Manage roster records, app access, and fixed app access roles here.
                    </p>
                  </div>
                  {canManageTeam ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                      aria-label="Add member"
                      title="Add member"
                      onClick={() => {
                        setSelectedMemberId(null);
                        setIsCreateMemberOpen(true);
                      }}
                    >
                      <i className="bi bi-person-plus" aria-hidden="true" />
                      <span>Add Member</span>
                    </button>
                  ) : null}
                </div>

                <CampaignStudioTeamToolbar
                  searchLabel="Search People"
                  searchPlaceholder="Search name or email"
                  searchState={peopleSearch}
                  onChange={setPeopleSearch}
                />

                <CampaignStudioTeamTable
                  members={filteredMembers}
                  onSelectMember={(memberId) => {
                    setSelectedMemberId(memberId);
                    setIsCreateMemberOpen(false);
                  }}
                />
              </section>

              <section className="campaign-team-workspace__section">
                <div className="campaign-team-workspace__section-header">
                  <div>
                    <h3 className="h5 mb-1">Teams</h3>
                    <p className="text-muted mb-0">
                      Create operational groups here, then manage membership from the team drawer.
                    </p>
                  </div>
                  {canManageTeam ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                      aria-label="Add team"
                      title="Add team"
                      onClick={() => {
                        setSelectedTeamId(null);
                        setIsCreateTeamOpen(true);
                      }}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      <span>Add Team</span>
                    </button>
                  ) : null}
                </div>

                <div className="campaign-team-table-toolbar">
                  <CampaignStudioTeamToolbar
                    searchLabel="Search Teams"
                    searchPlaceholder="Search team name or description"
                    searchState={teamSearchState}
                    onChange={setTeamSearchState}
                  />
                </div>

                <CampaignStudioTeamListTable
                  teams={filteredTeams}
                  selectedTeamId={isCreateTeamOpen ? null : selectedTeamId}
                  onSelectTeam={(teamId) => {
                    setSelectedTeamId(teamId);
                    setIsCreateTeamOpen(false);
                  }}
                />
              </section>
            </div>
          </>
        )}
      </CampaignStudioSectionCard>

      <CampaignStudioTeamMemberDrawer
        key={isCreateMemberOpen ? 'create-member' : selectedMember?.id ?? 'closed-member'}
        isOpen={isCreateMemberOpen || selectedMember !== null}
        isSaving={isSaving}
        member={isCreateMemberOpen ? null : selectedMember}
        roleCatalog={workspace?.roleCatalog ?? []}
        directoryUsers={workspace?.directoryUsers ?? []}
        canManageTeam={canManageTeam}
        onClose={() => {
          setSelectedMemberId(null);
          setIsCreateMemberOpen(false);
        }}
        onSave={async (input, memberId) => {
          const didSave = await saveMember(input, memberId);
          return didSave !== null;
        }}
        onSaveAccessRole={saveAccessRole}
        onLinkAppUser={async (memberId, input) => {
          const result = await linkAppUser(memberId, input);
          return result !== null;
        }}
        onInviteAppAccess={async (memberId, input) => {
          const result = await inviteAppAccess(memberId, input);
          return result !== null;
        }}
        onRemoveAppAccess={async (memberId) => {
          const result = await removeAppAccess(memberId);
          return result !== null;
        }}
        onOpenTeam={(teamId) => {
          setSelectedTeamId(teamId);
          setIsCreateTeamOpen(false);
        }}
        onOpenCreateTeam={() => {
          setSelectedTeamId(null);
          setIsCreateTeamOpen(true);
        }}
      />

      <CampaignStudioTeamTeamDrawer
        key={isCreateTeamOpen ? 'create-team' : selectedTeam?.id ?? 'closed-team'}
        isOpen={isCreateTeamOpen || selectedTeam !== null}
        isSaving={isSaving}
        team={isCreateTeamOpen ? null : selectedTeam}
        members={workspace?.members ?? []}
        canManageTeam={canManageTeam}
        onClose={() => {
          setSelectedTeamId(null);
          setIsCreateTeamOpen(false);
        }}
        onSave={async (input, teamId) => {
          const result = await saveTeam(input, teamId);
          return result !== null;
        }}
        onSaveRole={saveTeamRole}
        onAddMember={addMemberToTeam}
        onUpdateMemberRole={updateMemberTeamRole}
        onRemoveMember={removeMemberFromTeam}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="campaign-studio__stat-card">
      <span className="campaign-studio__stat-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function findById<T extends { id: string }>(items: T[] | undefined, id: string | null) {
  if (!items || !id) {
    return null;
  }
  return items.find((item) => item.id === id) ?? null;
}
