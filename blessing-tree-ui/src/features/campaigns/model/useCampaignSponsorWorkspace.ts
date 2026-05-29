import { useCallback, useEffect, useState } from 'react';
import {
  cancelPendingSponsorRegistration,
  createCampaignSponsor,
  createCampaignSponsorInteraction,
  deleteCampaignSponsor,
  deleteCampaignSponsorInteraction,
  getCampaignSponsorInteractions,
  getCampaignSponsorWorkspace,
  getPendingSponsorRegistrations,
  previewSponsorCommunication,
  resendPendingSponsorRegistration,
  sendSponsorCommunication,
  updateCampaignSponsor,
  updateCampaignSponsorInteraction,
  verifyPendingSponsorRegistration,
} from '@/features/campaigns/api/campaignSponsorWorkspaceApi';
import { listCommunicationTemplates } from '@/features/campaigns/api/campaignStudioApi';
import type {
  CampaignSponsor,
  CampaignSponsorInteraction,
  CampaignSponsorWorkspaceData,
  PendingSponsorRegistration,
  SponsorCommunicationPreview,
  SponsorCommunicationSendResult,
  SponsorInteractionUpsertInput,
  SponsorUpsertInput,
  SponsorshipUpsertInput,
} from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import type { CommunicationTemplate } from '@/features/campaigns/model/campaignStudioTypes';

interface InteractionState {
  items: CampaignSponsorInteraction[];
  isLoading: boolean;
  error: string | null;
  loaded: boolean;
}

interface CampaignSponsorWorkspaceState {
  workspace: CampaignSponsorWorkspaceData | null;
  pendingRegistrations: PendingSponsorRegistration[];
  pendingRegistrationError: string | null;
  communicationTemplates: CommunicationTemplate[];
  communicationTemplateError: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: string | null;
  interactionsBySponsor: Record<string, InteractionState>;
}

const emptyState: CampaignSponsorWorkspaceState = {
  workspace: null,
  pendingRegistrations: [],
  pendingRegistrationError: null,
  communicationTemplates: [],
  communicationTemplateError: null,
  isLoading: false,
  isSaving: false,
  error: null,
  saveMessage: null,
  interactionsBySponsor: {},
};

export function useCampaignSponsorWorkspace(campaignId: string | null) {
  const [state, setState] = useState<CampaignSponsorWorkspaceState>(emptyState);

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
      const [workspace, communicationTemplates] = await Promise.all([
        getCampaignSponsorWorkspace(campaignId),
        listCommunicationTemplates(campaignId),
      ]);
      let pendingRegistrations: PendingSponsorRegistration[] = [];
      let pendingRegistrationError: string | null = null;
      try {
        pendingRegistrations = await getPendingSponsorRegistrations(campaignId);
      } catch (pendingError) {
        pendingRegistrationError = toErrorMessage(pendingError, 'Unable to load pending sponsor registrations');
      }
      setState((currentState) => ({
        ...currentState,
        workspace,
        pendingRegistrations,
        pendingRegistrationError,
        communicationTemplates,
        communicationTemplateError: null,
        isLoading: false,
      }));
      return workspace;
    } catch (loadError) {
      setState((currentState) => ({
        ...currentState,
        workspace: null,
        pendingRegistrations: [],
        pendingRegistrationError: null,
        communicationTemplates: [],
        communicationTemplateError: null,
        isLoading: false,
        error: toErrorMessage(loadError, 'Unable to load Sponsors workspace'),
      }));
      return null;
    }
  }, [campaignId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const refreshSponsorInteractions = useCallback(
    async (sponsorId: string) => {
      if (!campaignId) {
        return [];
      }
      setState((currentState) => ({
        ...currentState,
        interactionsBySponsor: {
          ...currentState.interactionsBySponsor,
          [sponsorId]: {
            items: currentState.interactionsBySponsor[sponsorId]?.items ?? [],
            isLoading: true,
            error: null,
            loaded: currentState.interactionsBySponsor[sponsorId]?.loaded ?? false,
          },
        },
      }));
      try {
        const items = await getCampaignSponsorInteractions(campaignId, sponsorId);
        setState((currentState) => ({
          ...currentState,
          interactionsBySponsor: {
            ...currentState.interactionsBySponsor,
            [sponsorId]: {
              items,
              isLoading: false,
              error: null,
              loaded: true,
            },
          },
        }));
        return items;
      } catch (loadError) {
        setState((currentState) => ({
          ...currentState,
          interactionsBySponsor: {
            ...currentState.interactionsBySponsor,
            [sponsorId]: {
              items: currentState.interactionsBySponsor[sponsorId]?.items ?? [],
              isLoading: false,
              error: toErrorMessage(loadError, 'Unable to load sponsor communication log'),
              loaded: false,
            },
          },
        }));
        return [];
      }
    },
    [campaignId]
  );

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
        const workspace = await getCampaignSponsorWorkspace(campaignId);
        let pendingRegistrations: PendingSponsorRegistration[] = [];
        let pendingRegistrationError: string | null = null;
        try {
          pendingRegistrations = await getPendingSponsorRegistrations(campaignId);
        } catch (pendingError) {
          pendingRegistrationError = toErrorMessage(pendingError, 'Unable to load pending sponsor registrations');
        }
        setState((currentState) => ({
          ...currentState,
          workspace,
          pendingRegistrations,
          pendingRegistrationError,
          isLoading: false,
          isSaving: false,
          error: null,
          saveMessage: successMessage,
        }));
        return result;
      } catch (mutationError) {
        const message = toErrorMessage(mutationError, 'Unable to save Sponsors changes');
        setState((currentState) => ({
          ...currentState,
          isSaving: false,
          error: message,
          saveMessage: null,
        }));
        throw mutationError instanceof Error
          ? mutationError
          : new Error(message);
      }
    },
    [campaignId]
  );

  const previewCommunication = useCallback(
    async (sponsorId: string, templateId: string): Promise<SponsorCommunicationPreview | null> => {
      if (!campaignId) {
        return null;
      }
      return previewSponsorCommunication(campaignId, sponsorId, templateId);
    },
    [campaignId]
  );

  const sendCommunication = useCallback(
    async (sponsorId: string, templateId: string): Promise<SponsorCommunicationSendResult | null> => {
      if (!campaignId) {
        return null;
      }
      const result = await performMutation(
        () => sendSponsorCommunication(campaignId, sponsorId, templateId),
        'Sponsor communication sent.'
      );
      await refreshSponsorInteractions(sponsorId);
      return result;
    },
    [campaignId, performMutation, refreshSponsorInteractions]
  );

  const saveSponsor = useCallback(
    async (
      sponsor: SponsorUpsertInput,
      participation: SponsorshipUpsertInput,
      sponsorId?: string
    ): Promise<CampaignSponsor | null> => {
      if (!campaignId) {
        return null;
      }
      return performMutation(
        () =>
          sponsorId
            ? updateCampaignSponsor(campaignId, sponsorId, sponsor, participation)
            : createCampaignSponsor(campaignId, sponsor, participation),
        sponsorId ? 'Sponsor updated.' : 'Sponsor added.'
      );
    },
    [campaignId, performMutation]
  );

  const removeSponsor = useCallback(
    async (sponsorId: string) => {
      if (!campaignId) {
        return false;
      }
      const didDelete = await performMutation(
        () => deleteCampaignSponsor(campaignId, sponsorId),
        'Sponsor removed.'
      );
      return didDelete !== null;
    },
    [campaignId, performMutation]
  );

  const saveInteraction = useCallback(
    async (
      sponsorId: string,
      input: SponsorInteractionUpsertInput,
      interactionId?: string
    ): Promise<CampaignSponsorInteraction | null> => {
      if (!campaignId) {
        return null;
      }
      const result = await performMutation(
        () =>
          interactionId
            ? updateCampaignSponsorInteraction(campaignId, sponsorId, interactionId, input)
            : createCampaignSponsorInteraction(campaignId, sponsorId, input),
        interactionId ? 'Interaction updated.' : 'Interaction added.'
      );
      if (result) {
        await refreshSponsorInteractions(sponsorId);
      }
      return result;
    },
    [campaignId, performMutation, refreshSponsorInteractions]
  );

  const removeInteraction = useCallback(
    async (sponsorId: string, interactionId: string) => {
      if (!campaignId) {
        return false;
      }
      const didDelete = await performMutation(
        () => deleteCampaignSponsorInteraction(campaignId, sponsorId, interactionId),
        'Interaction removed.'
      );
      if (didDelete !== null) {
        await refreshSponsorInteractions(sponsorId);
      }
      return didDelete !== null;
    },
    [campaignId, performMutation, refreshSponsorInteractions]
  );

  const resendPendingRegistration = useCallback(
    async (registrationId: string) => {
      if (!campaignId) {
        return false;
      }
      const result = await performMutation(
        () => resendPendingSponsorRegistration(campaignId, registrationId),
        'Verification email resent.'
      );
      return result !== null;
    },
    [campaignId, performMutation]
  );

  const cancelPendingRegistration = useCallback(
    async (registrationId: string) => {
      if (!campaignId) {
        return false;
      }
      const result = await performMutation(
        () => cancelPendingSponsorRegistration(campaignId, registrationId),
        'Pending registration cancelled.'
      );
      return result !== null;
    },
    [campaignId, performMutation]
  );

  const verifyPendingRegistration = useCallback(
    async (registrationId: string) => {
      if (!campaignId) {
        return false;
      }
      const result = await performMutation(
        () => verifyPendingSponsorRegistration(campaignId, registrationId),
        'Pending registration verified.'
      );
      return result !== null;
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
    pendingRegistrations: state.pendingRegistrations,
    pendingRegistrationError: state.pendingRegistrationError,
    communicationTemplates: state.communicationTemplates,
    communicationTemplateError: state.communicationTemplateError,
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    error: state.error,
    saveMessage: state.saveMessage,
    interactionsBySponsor: state.interactionsBySponsor,
    reload: loadWorkspace,
    loadSponsorInteractions: refreshSponsorInteractions,
    previewCommunication,
    sendCommunication,
    saveSponsor,
    removeSponsor,
    saveInteraction,
    removeInteraction,
    resendPendingRegistration,
    cancelPendingRegistration,
    verifyPendingRegistration,
    clearSaveMessage,
    clearError,
  };
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
