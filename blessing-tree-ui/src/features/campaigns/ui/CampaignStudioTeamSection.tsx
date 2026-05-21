import { useMemo, useState } from 'react';
import {
  getCampaignTeamGlossaryEntry,
} from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import '@/features/campaigns/ui/campaignStudioTeam.css';
import { canManageCampaign } from '@/features/campaigns/model/campaignPermissions';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import { useCampaignTeamWorkspace } from '@/features/campaigns/model/useCampaignTeamWorkspace';
import { CampaignStudioSectionCard } from '@/features/campaigns/ui/CampaignStudioSectionCard';
import {
  CampaignStudioTeamToolbar,
  type CampaignStudioTeamFiltersState,
} from '@/features/campaigns/ui/CampaignStudioTeamToolbar';
import { CampaignStudioTeamTable } from '@/features/campaigns/ui/CampaignStudioTeamTable';
import { CampaignStudioTeamMemberDrawer } from '@/features/campaigns/ui/CampaignStudioTeamMemberDrawer';
import { CampaignStudioTeamTeamDrawer } from '@/features/campaigns/ui/CampaignStudioTeamTeamDrawer';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

interface CampaignStudioTeamSectionProps {
  campaignId: string;
  access: CampaignAccess;
}

const defaultFilters: CampaignStudioTeamFiltersState = {
  search: '',
  roleKey: '',
  teamId: '',
  appAccessStatus: '',
  memberType: '',
  includeInactive: false,
};

export function CampaignStudioTeamSection({
  campaignId,
  access,
}: CampaignStudioTeamSectionProps) {
  const canManageTeam = canManageCampaign(access);
  const memberTypeHelp = getCampaignTeamGlossaryEntry('member_type');
  const appAccessHelp = getCampaignTeamGlossaryEntry('app_access');
  const appAccessRolesHelp = getCampaignTeamGlossaryEntry('app_access_roles');
  const teamsHelp = getCampaignTeamGlossaryEntry('teams');
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
  } = useCampaignTeamWorkspace(campaignId);
  const [filters, setFilters] = useState<CampaignStudioTeamFiltersState>(defaultFilters);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isCreateMemberOpen, setIsCreateMemberOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  const filteredMembers = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const normalizedSearch = filters.search.trim().toLowerCase();

    return workspace.members
      .filter((member) => {
        if (!filters.includeInactive && !member.isActive) {
          return false;
        }
        if (normalizedSearch) {
          const haystack = `${member.displayName} ${member.email ?? ''}`.toLowerCase();
          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }
        if (filters.roleKey && !member.accessRoles.some((role) => role.roleKey === filters.roleKey)) {
          return false;
        }
        if (filters.teamId && !member.teams.some((team) => team.id === filters.teamId)) {
          return false;
        }
        if (filters.appAccessStatus && member.appAccessStatus !== filters.appAccessStatus) {
          return false;
        }
        if (filters.memberType && member.memberType !== filters.memberType) {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [filters, workspace]);

  const selectedMember = findById(workspace?.members, selectedMemberId);
  const selectedTeam = findById(workspace?.teams, selectedTeamId);

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
            <div className="campaign-team-glossary">
              {[memberTypeHelp, appAccessHelp, appAccessRolesHelp, teamsHelp].map((entry) => (
                <div key={entry.key} className="campaign-team-glossary__item">
                  <div className="campaign-team-glossary__label">
                    <span>{entry.label}</span>
                    <InlineHelpPopover title={entry.label} body={entry.description} />
                  </div>
                  <p>{entry.description}</p>
                </div>
              ))}
            </div>

            <div className="campaign-studio__stat-grid">
              <StatCard label="Managers" value={workspace.counts.managerCount} />
              <StatCard label="Active Assignments" value={workspace.counts.activeAssignmentCount} />
              <StatCard label="Roster" value={workspace.counts.memberCount} />
              <StatCard label="App Access" value={workspace.counts.membersWithAppAccessCount} />
              <StatCard label="Teams" value={workspace.counts.teamCount} />
            </div>

            <CampaignStudioTeamToolbar
              filters={filters}
              teamOptions={workspace.teams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
              roleOptions={workspace.roleCatalog}
              canManageTeam={canManageTeam}
              onChange={setFilters}
              onAddMember={() => {
                setSelectedMemberId(null);
                setIsCreateMemberOpen(true);
              }}
              onAddTeam={() => {
                setSelectedTeamId(null);
                setIsCreateTeamOpen(true);
              }}
            />

            <div className="campaign-team-workspace">
              <div className="campaign-team-workspace__main">
                <CampaignStudioTeamTable
                  members={filteredMembers}
                  roleCatalog={workspace.roleCatalog}
                  onSelectMember={(memberId) => {
                    setSelectedMemberId(memberId);
                    setIsCreateMemberOpen(false);
                  }}
                />
              </div>

              <aside className="campaign-team-workspace__side">
                <div className="campaign-team-side-card">
                  <div className="campaign-team-side-card__header">
                    <div>
                      <h3 className="h6 mb-1">Teams</h3>
                      <p className="text-muted mb-0">
                        Use teams for communication audiences and operating groups.
                      </p>
                    </div>
                    {canManageTeam ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setSelectedTeamId(null);
                          setIsCreateTeamOpen(true);
                        }}
                      >
                        New Team
                      </button>
                    ) : null}
                  </div>

                  <div className="campaign-team-side-list">
                    {workspace.teams.length === 0 ? (
                      <div className="campaign-studio__empty-note">No teams created yet.</div>
                    ) : (
                      workspace.teams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          className="campaign-team-side-item"
                          onClick={() => {
                            setSelectedTeamId(team.id);
                            setIsCreateTeamOpen(false);
                          }}
                        >
                          <strong>{team.name}</strong>
                          <span>
                            {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </CampaignStudioSectionCard>

      <CampaignStudioTeamMemberDrawer
        key={isCreateMemberOpen ? 'create-member' : selectedMember?.id ?? 'closed-member'}
        isOpen={isCreateMemberOpen || selectedMember !== null}
        isSaving={isSaving}
        member={isCreateMemberOpen ? null : selectedMember}
        teams={workspace?.teams ?? []}
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
        onAddMemberToTeam={addMemberToTeam}
        onRemoveMemberFromTeam={removeMemberFromTeam}
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
        onAddMember={addMemberToTeam}
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
