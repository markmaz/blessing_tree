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
    saveMessage,
    onSaveGroup,
    onSaveContact,
    onDeleteContact,
    onSaveRecipient,
    onSaveWishlist,
    onSaveWishlistItem,
    onDeleteWishlistItem,
    onSearchAddresses,
    onClearSaveMessage,
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
      saveMessage={saveMessage}
      onSaveGroup={onSaveGroup}
      onSaveContact={onSaveContact}
      onDeleteContact={onDeleteContact}
      onSaveRecipient={onSaveRecipient}
      onSaveWishlist={onSaveWishlist}
      onSaveWishlistItem={onSaveWishlistItem}
      onDeleteWishlistItem={onDeleteWishlistItem}
      onSearchAddresses={onSearchAddresses}
      onClearSaveMessage={onClearSaveMessage}
      onClearError={onClearError}
      showHero={false}
      showCreateActions={false}
    />
  );
}
