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
    <section className="campaign-page-stack">
      <div>
        <h1 className="h3 mb-1">People Directory</h1>
        <p className="text-muted mb-0">
          Search and maintain existing households, organizations, people, and wishlists for this campaign.
        </p>
      </div>

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
        onDeleteGroup={onDeleteGroup}
        onDeleteRecipient={onDeleteRecipient}
        onSaveWishlistItem={onSaveWishlistItem}
        onDeleteWishlistItem={onDeleteWishlistItem}
        onSearchAddresses={onSearchAddresses}
        onClearError={onClearError}
        showHero={false}
        showCreateActions={false}
      />
    </section>
  );
}
