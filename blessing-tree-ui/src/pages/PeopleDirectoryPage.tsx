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
    onSaveWishlistItem,
    onDeleteWishlistItem,
    onSearchAddresses,
    onClearError,
  } = usePeopleWorkspaceContext();

  return (
    <CampaignPeopleWorkspace
      campaignName={campaignName}
      access={access}
      workspace={workspace}
      isLoading={isLoading}
      isSaving={isSaving}
      error={error}
      onSaveGroup={onSaveGroup}
      onSaveContact={onSaveContact}
      onDeleteContact={onDeleteContact}
      onSaveRecipient={onSaveRecipient}
      onSaveWishlistItem={onSaveWishlistItem}
      onDeleteWishlistItem={onDeleteWishlistItem}
      onSearchAddresses={onSearchAddresses}
      onClearError={onClearError}
      showHero={false}
      showCreateActions={false}
    />
  );
}
