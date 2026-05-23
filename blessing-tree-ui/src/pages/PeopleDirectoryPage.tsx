import { usePeopleWorkspaceContext } from '@/features/campaigns/model/peopleWorkspaceContext';
import { CampaignPeopleWorkspace } from '@/features/campaigns/ui/CampaignPeopleWorkspace';

export function PeopleDirectoryPage() {
  const {
    campaignName,
    access,
    workspace,
    isLoading,
    isSaving,
    error,
    onSaveGroup,
    onSaveContact,
    onDeleteContact,
    onSaveRecipient,
    onDeleteGroup,
    onDeleteRecipient,
    onSaveWishlistItem,
    onDeleteWishlistItem,
    onSearchAddresses,
    onClearError,
  } = usePeopleWorkspaceContext();

  return (
    <CampaignPeopleWorkspace
      campaignName={campaignName}
      heroContextLabel="Directory"
      access={access}
      workspace={workspace}
      isLoading={isLoading}
      isSaving={isSaving}
      error={error}
      onSaveGroup={onSaveGroup}
      onSaveContact={onSaveContact}
      onDeleteContact={onDeleteContact}
      onSaveRecipient={onSaveRecipient}
      onDeleteGroup={onDeleteGroup}
      onDeleteRecipient={onDeleteRecipient}
      onSaveWishlistItem={onSaveWishlistItem}
      onDeleteWishlistItem={onDeleteWishlistItem}
      onSearchAddresses={onSearchAddresses}
      onClearError={onClearError}
      showHero
      showCreateActions={false}
    />
  );
}
