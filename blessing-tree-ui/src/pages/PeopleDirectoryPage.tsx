import { usePeopleWorkspaceContext } from '@/features/campaigns/model/peopleWorkspaceContext';
import { CampaignPeopleWorkspace } from '@/features/campaigns/ui/CampaignPeopleWorkspace';
import { WorkspacePageHeader } from '@/shared/ui/WorkspacePageHeader';

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
      <WorkspacePageHeader
        title="People Directory"
        description="Search and maintain existing households, organizations, people, and wishlists for this campaign."
      />

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
