import { useState } from 'react';
import { getCampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import { campaignMemberTypeOptions } from '@/features/campaigns/model/campaignTeamWorkspacePresentation';
import type {
  CampaignDirectoryUserOption,
  CampaignMemberAppInviteInput,
  CampaignMemberAppLinkInput,
  CampaignRoleCatalogEntry,
  CampaignTeamMemberUpsertInput,
  CampaignTeamWorkspaceMember,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import { CampaignStudioTeamMemberAccessRolesSection } from '@/features/campaigns/ui/CampaignStudioTeamMemberAccessRolesSection';
import { CampaignStudioTeamMemberAppAccessSection } from '@/features/campaigns/ui/CampaignStudioTeamMemberAppAccessSection';
import { CampaignStudioTeamMemberTeamsSection } from '@/features/campaigns/ui/CampaignStudioTeamMemberTeamsSection';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

interface CampaignStudioTeamMemberDrawerProps {
  isOpen: boolean;
  isSaving: boolean;
  member: CampaignTeamWorkspaceMember | null;
  roleCatalog: CampaignRoleCatalogEntry[];
  directoryUsers: CampaignDirectoryUserOption[];
  canManageTeam: boolean;
  onClose: () => void;
  onSave: (input: CampaignTeamMemberUpsertInput, memberId?: string) => Promise<boolean>;
  onSaveAccessRole: (
    memberId: string,
    input: { roleKey: string; isActive?: boolean },
    assignmentId?: string
  ) => Promise<boolean>;
  onLinkAppUser: (
    memberId: string,
    input: CampaignMemberAppLinkInput
  ) => Promise<boolean>;
  onInviteAppAccess: (
    memberId: string,
    input: CampaignMemberAppInviteInput
  ) => Promise<boolean>;
  onRemoveAppAccess: (memberId: string) => Promise<boolean>;
  onOpenTeam: (teamId: string) => void;
  onOpenCreateTeam: () => void;
}

const emptyFormState: CampaignTeamMemberUpsertInput = {
  displayName: '',
  email: '',
  phone: '',
  notes: '',
  memberType: 'volunteer',
  appAccessStatus: 'none',
  isActive: true,
};

export function CampaignStudioTeamMemberDrawer({
  isOpen,
  isSaving,
  member,
  roleCatalog,
  directoryUsers,
  canManageTeam,
  onClose,
  onSave,
  onSaveAccessRole,
  onLinkAppUser,
  onInviteAppAccess,
  onRemoveAppAccess,
  onOpenTeam,
  onOpenCreateTeam,
}: CampaignStudioTeamMemberDrawerProps) {
  const memberTypeHelp = getCampaignTeamGlossaryEntry('member_type');
  const [formState, setFormState] = useState<CampaignTeamMemberUpsertInput>(
    member
      ? {
          displayName: member.displayName,
          email: member.email ?? '',
          phone: member.phone ?? '',
          notes: member.notes ?? '',
          memberType: member.memberType,
          appAccessStatus: member.appAccessStatus,
          isActive: member.isActive,
        }
      : emptyFormState
  );
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>(
    roleCatalog[0]?.roleKey ?? ''
  );
  const [selectedDirectoryUserId, setSelectedDirectoryUserId] = useState(
    member?.appUserId ?? ''
  );
  const [selectedLinkStatus, setSelectedLinkStatus] = useState<'linked' | 'active'>(
    member?.appAccessStatus === 'active' ? 'active' : 'linked'
  );
  const [selectedInviteStatus, setSelectedInviteStatus] = useState<
    CampaignMemberAppInviteInput['appAccessStatus']
  >(member?.appAccessStatus === 'active' ? 'active' : 'invited');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const didSave = await onSave(formState, member?.id);
    if (didSave) {
      onClose();
    }
  };

  return (
    <CampaignStudioDrawer
      isOpen={isOpen}
      title={member ? member.displayName : 'Add Person'}
      description="Track campaign people, assign fixed access roles, and place them on operational teams."
      onClose={onClose}
      width="wide"
    >
      <form className="campaign-team-drawer__stack" onSubmit={handleSubmit}>
        <section className="campaign-team-drawer__section">
          <div className="campaign-team-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">Profile</h4>
              <p className="text-muted mb-0">
                Campaign people do not need app access to exist in the roster.
              </p>
            </div>
          </div>
          <div className="campaign-team-form-grid">
            <label className="form-label">
              Display Name
              <input
                className="form-control"
                value={formState.displayName}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-label">
              Email
              <input
                className="form-control"
                value={formState.email ?? ''}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-label">
              Phone
              <input
                className="form-control"
                value={formState.phone ?? ''}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <label className="form-label">
              Member Type
              <InlineHelpPopover title={memberTypeHelp.label} body={memberTypeHelp.description} />
              <select
                className="form-select"
                value={formState.memberType}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    memberType: event.target.value as CampaignTeamMemberUpsertInput['memberType'],
                  }))
                }
              >
                {campaignMemberTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
              <span>Person is active for this campaign</span>
            </label>
            <label className="form-label campaign-team-form-grid__span-2">
              Notes
              <textarea
                className="form-control"
                rows={3}
                value={formState.notes ?? ''}
                disabled={!canManageTeam || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </section>

        {member ? (
          <>
            <CampaignStudioTeamMemberAccessRolesSection
              member={member}
              roleCatalog={roleCatalog}
              canManageTeam={canManageTeam}
              isSaving={isSaving}
              selectedRoleKey={selectedRoleKey}
              onSelectRoleKey={setSelectedRoleKey}
              onSaveAccessRole={onSaveAccessRole}
            />

            <CampaignStudioTeamMemberTeamsSection
              member={member}
              canManageTeam={canManageTeam}
              onOpenTeam={onOpenTeam}
              onOpenCreateTeam={onOpenCreateTeam}
            />

            <CampaignStudioTeamMemberAppAccessSection
              member={member}
              directoryUsers={directoryUsers}
              selectedDirectoryUserId={selectedDirectoryUserId}
              selectedLinkStatus={selectedLinkStatus}
              selectedInviteStatus={selectedInviteStatus}
              canManageTeam={canManageTeam}
              isSaving={isSaving}
              onSelectDirectoryUserId={setSelectedDirectoryUserId}
              onSelectLinkStatus={setSelectedLinkStatus}
              onSelectInviteStatus={setSelectedInviteStatus}
              onLinkAppUser={onLinkAppUser}
              onInviteAppAccess={onInviteAppAccess}
              onRemoveAppAccess={onRemoveAppAccess}
            />
          </>
        ) : null}

        <div className="campaign-team-drawer__actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          {canManageTeam ? (
            <button type="submit" className="btn btn-secondary" disabled={isSaving}>
              {isSaving ? 'Saving...' : member ? 'Save Person' : 'Create Person'}
            </button>
          ) : null}
        </div>
      </form>
    </CampaignStudioDrawer>
  );
}
