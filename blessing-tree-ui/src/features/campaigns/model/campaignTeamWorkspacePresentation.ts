import type {
  CampaignRoleCatalogEntry,
  CampaignMemberAppAccessStatus,
  CampaignMemberType,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

export const campaignMemberTypeOptions: Array<{
  value: CampaignMemberType;
  label: string;
}> = [
  { value: 'staff', label: 'Staff' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'contact', label: 'Contact' },
  { value: 'external', label: 'External' },
];

export const campaignAppAccessStatusOptions: Array<{
  value: CampaignMemberAppAccessStatus;
  label: string;
}> = [
  { value: 'none', label: 'No App Access' },
  { value: 'linked', label: 'Linked' },
  { value: 'invited', label: 'Invited' },
  { value: 'active', label: 'Active' },
];

export function toCampaignRoleLabel(
  roleKey: string,
  roleCatalog: CampaignRoleCatalogEntry[] = []
): string {
  return (
    roleCatalog.find((role) => role.roleKey === roleKey)?.label ??
    humanizeKey(roleKey)
  );
}

export function getCampaignRoleDescription(
  roleKey: string,
  roleCatalog: CampaignRoleCatalogEntry[] = []
): string {
  return roleCatalog.find((role) => role.roleKey === roleKey)?.description ?? '';
}

export function toCampaignMemberTypeLabel(memberType: CampaignMemberType): string {
  return (
    campaignMemberTypeOptions.find((option) => option.value === memberType)?.label ??
    humanizeKey(memberType)
  );
}

export function toCampaignAppAccessStatusLabel(
  status: CampaignMemberAppAccessStatus
): string {
  return (
    campaignAppAccessStatusOptions.find((option) => option.value === status)?.label ??
    humanizeKey(status)
  );
}

function humanizeKey(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
