import { getCampaignTeamGlossaryEntry } from '@/features/campaigns/model/campaignTeamWorkspaceGlossary';
import {
  campaignAppAccessStatusOptions,
  campaignMemberTypeOptions,
} from '@/features/campaigns/model/campaignTeamWorkspacePresentation';
import type {
  CampaignMemberAppAccessStatus,
  CampaignMemberType,
  CampaignRoleCatalogEntry,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';
import { InlineHelpPopover } from '@/shared/ui/InlineHelpPopover';

export interface CampaignStudioTeamFiltersState {
  search: string;
  roleKey: string;
  teamId: string;
  appAccessStatus: CampaignMemberAppAccessStatus | '';
  memberType: CampaignMemberType | '';
  includeInactive: boolean;
}

interface CampaignStudioTeamToolbarProps {
  filters: CampaignStudioTeamFiltersState;
  teamOptions: Array<{ id: string; name: string }>;
  roleOptions: CampaignRoleCatalogEntry[];
  canManageTeam: boolean;
  onChange: (next: CampaignStudioTeamFiltersState) => void;
  onAddMember: () => void;
  onAddTeam: () => void;
}

export function CampaignStudioTeamToolbar({
  filters,
  teamOptions,
  roleOptions,
  canManageTeam,
  onChange,
  onAddMember,
  onAddTeam,
}: CampaignStudioTeamToolbarProps) {
  const memberTypeHelp = getCampaignTeamGlossaryEntry('member_type');
  const appAccessHelp = getCampaignTeamGlossaryEntry('app_access');
  const accessRolesHelp = getCampaignTeamGlossaryEntry('app_access_roles');

  return (
    <div className="campaign-team-toolbar">
      <label className="form-label campaign-team-toolbar__search">
        Search People
        <input
          className="form-control"
          value={filters.search}
          placeholder="Search name or email"
          onChange={(event) =>
            onChange({
              ...filters,
              search: event.target.value,
            })
          }
        />
      </label>

      <label className="form-label">
        App Access Role
        <InlineHelpPopover title={accessRolesHelp.label} body={accessRolesHelp.description} />
        <select
          className="form-select"
          value={filters.roleKey}
          onChange={(event) =>
            onChange({
              ...filters,
              roleKey: event.target.value,
            })
          }
        >
          <option value="">All roles</option>
          {roleOptions.map((role) => (
            <option key={role.roleKey} value={role.roleKey}>
              {role.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-label">
        Team
        <select
          className="form-select"
          value={filters.teamId}
          onChange={(event) =>
            onChange({
              ...filters,
              teamId: event.target.value,
            })
          }
        >
          <option value="">All teams</option>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <label className="form-label">
        App Access
        <InlineHelpPopover title={appAccessHelp.label} body={appAccessHelp.description} />
        <select
          className="form-select"
          value={filters.appAccessStatus}
          onChange={(event) =>
            onChange({
              ...filters,
              appAccessStatus: event.target.value as CampaignMemberAppAccessStatus | '',
            })
          }
        >
          <option value="">Any access state</option>
          {campaignAppAccessStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-label">
        Member Type
        <InlineHelpPopover title={memberTypeHelp.label} body={memberTypeHelp.description} />
        <select
          className="form-select"
          value={filters.memberType}
          onChange={(event) =>
            onChange({
              ...filters,
              memberType: event.target.value as CampaignMemberType | '',
            })
          }
        >
          <option value="">All types</option>
          {campaignMemberTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="campaign-team-toolbar__toggle">
        <input
          type="checkbox"
          checked={filters.includeInactive}
          onChange={(event) =>
            onChange({
              ...filters,
              includeInactive: event.target.checked,
            })
          }
        />
        <span>Include inactive people</span>
      </label>

      {canManageTeam ? (
        <div className="campaign-team-toolbar__actions">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onAddTeam}>
            New Team
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddMember}>
            Add Person
          </button>
        </div>
      ) : null}
    </div>
  );
}
