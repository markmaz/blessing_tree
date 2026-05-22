import { useOutletContext } from 'react-router-dom';
import type { CampaignAccess } from '@/features/campaigns/model/campaignTypes';
import type {
  CampaignPeopleGroup,
  CampaignPeopleGroupContact,
  CampaignPeopleWorkspaceData,
  CampaignRecipient,
  CampaignWishlist,
  CampaignWishlistItem,
  GroupContactUpsertInput,
  RecipientGroupUpsertInput,
  RecipientUpsertInput,
  WishlistItemUpsertInput,
  WishlistUpsertInput,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';

export interface PeopleWorkspaceOutletContext {
  campaignId: string;
  campaignName: string;
  access: CampaignAccess | null;
  workspace: CampaignPeopleWorkspaceData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: string | null;
  onSaveGroup: (
    input: RecipientGroupUpsertInput,
    groupId?: string
  ) => Promise<CampaignPeopleGroup | null>;
  onSaveContact: (
    groupId: string,
    input: GroupContactUpsertInput,
    contactId?: string
  ) => Promise<CampaignPeopleGroupContact | null>;
  onDeleteContact: (groupId: string, contactId: string) => Promise<boolean>;
  onSaveRecipient: (
    input: RecipientUpsertInput,
    recipientId?: string
  ) => Promise<CampaignRecipient | null>;
  onSaveWishlist: (
    recipientId: string,
    input: WishlistUpsertInput
  ) => Promise<CampaignWishlist | null | unknown>;
  onSaveWishlistItem: (
    recipientId: string,
    input: WishlistItemUpsertInput,
    itemId?: string
  ) => Promise<CampaignWishlistItem | null>;
  onDeleteWishlistItem: (recipientId: string, itemId: string) => Promise<boolean>;
  onClearSaveMessage: () => void;
  onClearError: () => void;
}

export function usePeopleWorkspaceContext() {
  return useOutletContext<PeopleWorkspaceOutletContext>();
}
