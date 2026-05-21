import {
  campaignAppAccessStatusOptions,
  toCampaignAppAccessStatusLabel,
} from '@/features/campaigns/model/campaignTeamWorkspacePresentation';
import type {
  CampaignDirectoryUserOption,
  CampaignMemberAppInviteInput,
  CampaignTeamWorkspaceMember,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { InlineConfirmAction } from '@/shared/ui/InlineConfirmAction';

interface CampaignStudioTeamMemberAppAccessSectionProps {
  member: CampaignTeamWorkspaceMember;
  directoryUsers: CampaignDirectoryUserOption[];
  selectedDirectoryUserId: string;
  selectedLinkStatus: 'linked' | 'active';
  selectedInviteStatus: CampaignMemberAppInviteInput['appAccessStatus'];
  canManageTeam: boolean;
  isSaving: boolean;
  onSelectDirectoryUserId: (userId: string) => void;
  onSelectLinkStatus: (status: 'linked' | 'active') => void;
  onSelectInviteStatus: (status: CampaignMemberAppInviteInput['appAccessStatus']) => void;
  onLinkAppUser: (
    memberId: string,
    input: { userId: string; appAccessStatus?: 'linked' | 'active' }
  ) => Promise<boolean>;
  onInviteAppAccess: (
    memberId: string,
    input: CampaignMemberAppInviteInput
  ) => Promise<boolean>;
  onRemoveAppAccess: (memberId: string) => Promise<boolean>;
}

export function CampaignStudioTeamMemberAppAccessSection({
  member,
  directoryUsers,
  selectedDirectoryUserId,
  selectedLinkStatus,
  selectedInviteStatus,
  canManageTeam,
  isSaving,
  onSelectDirectoryUserId,
  onSelectLinkStatus,
  onSelectInviteStatus,
  onLinkAppUser,
  onInviteAppAccess,
  onRemoveAppAccess,
}: CampaignStudioTeamMemberAppAccessSectionProps) {
  const selectedDirectoryUser = directoryUsers.find((user) => user.id === selectedDirectoryUserId);

  return (
    <section className="campaign-team-drawer__section">
      <div className="campaign-team-drawer__section-header">
        <div>
          <h4 className="h6 mb-1">App Access</h4>
          <p className="text-muted mb-0">
            Link to an app user, prepare an invite, or keep this person roster-only.
          </p>
        </div>
      </div>

      <div className="campaign-chip-row mb-3">
        <span className="campaign-chip campaign-chip-muted">
          {toCampaignAppAccessStatusLabel(member.appAccessStatus)}
        </span>
        {member.appUser ? (
          <span className="campaign-chip">
            {member.appUser.displayName} · {member.appUser.appRole}
          </span>
        ) : null}
      </div>

      <div className="campaign-team-form-grid">
        <label className="form-label campaign-team-form-grid__span-2">
          Directory User
          <select
            className="form-select"
            value={selectedDirectoryUserId}
            disabled={!canManageTeam || isSaving}
            onChange={(event) => onSelectDirectoryUserId(event.target.value)}
          >
            <option value="">No linked app user</option>
            {directoryUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} · {user.email}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Link Status
          <select
            className="form-select"
            value={selectedLinkStatus}
            disabled={!canManageTeam || isSaving}
            onChange={(event) => onSelectLinkStatus(event.target.value as 'linked' | 'active')}
          >
            <option value="linked">Linked</option>
            <option value="active">Active</option>
          </select>
        </label>
        <label className="form-label">
          Invite Status
          <select
            className="form-select"
            value={selectedInviteStatus}
            disabled={!canManageTeam || isSaving}
            onChange={(event) =>
              onSelectInviteStatus(
                event.target.value as CampaignMemberAppInviteInput['appAccessStatus']
              )
            }
          >
            {campaignAppAccessStatusOptions
              .filter((option) => option.value !== 'none')
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      {selectedDirectoryUser ? (
        <div className="form-text mt-2">
          Selected user: {selectedDirectoryUser.displayName} · {selectedDirectoryUser.email}
        </div>
      ) : null}

      <div className="campaign-team-drawer__action-row">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={!canManageTeam || !selectedDirectoryUserId || isSaving}
          onClick={() =>
            void onLinkAppUser(member.id, {
              userId: selectedDirectoryUserId,
              appAccessStatus: selectedLinkStatus,
            })
          }
        >
          Link App User
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!canManageTeam || !member.email || isSaving}
          onClick={() =>
            void onInviteAppAccess(member.id, {
              userId: selectedDirectoryUserId || null,
              appAccessStatus: selectedInviteStatus,
            })
          }
        >
          Prepare Invite
        </button>
        {member.appAccessStatus !== 'none' ? (
          <InlineConfirmAction
            buttonLabel="Remove App Access"
            confirmLabel="Remove Access"
            cancelLabel="Cancel"
            message={`Remove app access from ${member.displayName}?`}
            tone="secondary"
            disabled={!canManageTeam || isSaving}
            onConfirm={async () => {
              await onRemoveAppAccess(member.id);
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
