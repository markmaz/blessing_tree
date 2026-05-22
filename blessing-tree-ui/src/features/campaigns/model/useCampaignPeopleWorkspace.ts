import { useCallback, useEffect, useState } from 'react';
import {
  createCampaignRecipient,
  createCampaignWishlistItem,
  createRecipientGroup,
  createRecipientGroupContact,
  deleteCampaignWishlistItem,
  deleteRecipientGroupContact,
  getCampaignPeopleWorkspace,
  updateCampaignRecipient,
  updateCampaignWishlistItem,
  updateRecipientGroup,
  updateRecipientGroupContact,
  upsertCampaignWishlist,
} from '@/features/campaigns/api/campaignPeopleWorkspaceApi';
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

interface CampaignPeopleWorkspaceState {
  workspace: CampaignPeopleWorkspaceData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: string | null;
}

const emptyState: CampaignPeopleWorkspaceState = {
  workspace: null,
  isLoading: false,
  isSaving: false,
  error: null,
  saveMessage: null,
};

export function useCampaignPeopleWorkspace(campaignId: string | null) {
  const [state, setState] = useState<CampaignPeopleWorkspaceState>(emptyState);

  const loadWorkspace = useCallback(async () => {
    if (!campaignId) {
      setState(emptyState);
      return null;
    }

    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      error: null,
    }));

    try {
      const workspace = await getCampaignPeopleWorkspace(campaignId);
      setState((currentState) => ({
        ...currentState,
        workspace,
        isLoading: false,
      }));
      return workspace;
    } catch (loadError) {
      setState((currentState) => ({
        ...currentState,
        workspace: null,
        isLoading: false,
        error: toErrorMessage(loadError, 'Unable to load People workspace'),
      }));
      return null;
    }
  }, [campaignId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const performMutation = useCallback(
    async <T,>(mutate: () => Promise<T>, successMessage: string): Promise<T | null> => {
      if (!campaignId) {
        return null;
      }

      setState((currentState) => ({
        ...currentState,
        isSaving: true,
        error: null,
        saveMessage: null,
      }));

      try {
        const result = await mutate();
        const workspace = await getCampaignPeopleWorkspace(campaignId);
        setState({
          workspace,
          isLoading: false,
          isSaving: false,
          error: null,
          saveMessage: successMessage,
        });
        return result;
      } catch (mutationError) {
        setState((currentState) => ({
          ...currentState,
          isSaving: false,
          error: toErrorMessage(mutationError, 'Unable to save People changes'),
          saveMessage: null,
        }));
        return null;
      }
    },
    [campaignId]
  );

  const saveGroup = useCallback(
    async (input: RecipientGroupUpsertInput, groupId?: string): Promise<CampaignPeopleGroup | null> => {
      if (!campaignId) {
        return null;
      }

      return performMutation(
        () =>
          groupId
            ? updateRecipientGroup(campaignId, groupId, input)
            : createRecipientGroup(campaignId, input),
        groupId ? 'Group updated.' : 'Group added.'
      );
    },
    [campaignId, performMutation]
  );

  const saveContact = useCallback(
    async (
      groupId: string,
      input: GroupContactUpsertInput,
      contactId?: string
    ): Promise<CampaignPeopleGroupContact | null> => {
      if (!campaignId) {
        return null;
      }

      return performMutation(
        () =>
          contactId
            ? updateRecipientGroupContact(campaignId, groupId, contactId, input)
            : createRecipientGroupContact(campaignId, groupId, input),
        contactId ? 'Contact updated.' : 'Contact added.'
      );
    },
    [campaignId, performMutation]
  );

  const removeContact = useCallback(
    async (groupId: string, contactId: string) => {
      if (!campaignId) {
        return false;
      }

      const didDelete = await performMutation(
        () => deleteRecipientGroupContact(campaignId, groupId, contactId),
        'Contact removed.'
      );
      return didDelete !== null;
    },
    [campaignId, performMutation]
  );

  const saveRecipient = useCallback(
    async (input: RecipientUpsertInput, recipientId?: string): Promise<CampaignRecipient | null> => {
      if (!campaignId) {
        return null;
      }

      return performMutation(
        () =>
          recipientId
            ? updateCampaignRecipient(campaignId, recipientId, input)
            : createCampaignRecipient(campaignId, input),
        recipientId ? 'Person updated.' : 'Person added.'
      );
    },
    [campaignId, performMutation]
  );

  const saveWishlist = useCallback(
    async (recipientId: string, input: WishlistUpsertInput): Promise<CampaignWishlist | null> => {
      if (!campaignId) {
        return null;
      }

      return performMutation(
        () => upsertCampaignWishlist(campaignId, recipientId, input),
        'Wishlist saved.'
      );
    },
    [campaignId, performMutation]
  );

  const saveWishlistItem = useCallback(
    async (
      recipientId: string,
      input: WishlistItemUpsertInput,
      itemId?: string
    ): Promise<CampaignWishlistItem | null> => {
      if (!campaignId) {
        return null;
      }

      return performMutation(
        () =>
          itemId
            ? updateCampaignWishlistItem(campaignId, recipientId, itemId, input)
            : createCampaignWishlistItem(campaignId, recipientId, input),
        itemId ? 'Wishlist item updated.' : 'Wishlist item added.'
      );
    },
    [campaignId, performMutation]
  );

  const removeWishlistItem = useCallback(
    async (recipientId: string, itemId: string) => {
      if (!campaignId) {
        return false;
      }

      const didDelete = await performMutation(
        () => deleteCampaignWishlistItem(campaignId, recipientId, itemId),
        'Wishlist item removed.'
      );
      return didDelete !== null;
    },
    [campaignId, performMutation]
  );

  const clearSaveMessage = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      saveMessage: null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      error: null,
    }));
  }, []);

  return {
    workspace: state.workspace,
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    error: state.error,
    saveMessage: state.saveMessage,
    reload: loadWorkspace,
    saveGroup,
    saveContact,
    removeContact,
    saveRecipient,
    saveWishlist,
    saveWishlistItem,
    removeWishlistItem,
    clearSaveMessage,
    clearError,
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
