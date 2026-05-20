import { useEffect, useState } from 'react';
import {
  createCommunicationSchedule,
  createCommunicationTemplate,
  getCampaignStudio,
  saveCampaignMilestones,
} from '@/features/campaigns/api/campaignStudioApi';
import type {
  CampaignStudioData,
  CreateCommunicationScheduleInput,
  CreateCommunicationTemplateInput,
  SaveCampaignMilestoneInput,
} from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignStudioState {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: string | null;
  studio: CampaignStudioData | null;
}

const emptyState: CampaignStudioState = {
  isLoading: false,
  isSaving: false,
  error: null,
  saveMessage: null,
  studio: null,
};

export function useCampaignStudio(campaignId: string | null) {
  const [state, setState] = useState<CampaignStudioState>(emptyState);

  useEffect(() => {
    if (!campaignId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: null,
      }));

      try {
        const studio = await getCampaignStudio(campaignId);
        if (cancelled) {
          return;
        }
        setState({
          isLoading: false,
          isSaving: false,
          error: null,
          saveMessage: null,
          studio,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setState({
          isLoading: false,
          isSaving: false,
          error: toErrorMessage(loadError, 'Unable to load campaign studio'),
          saveMessage: null,
          studio: null,
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const reload = async () => {
    if (!campaignId) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      error: null,
    }));

    try {
      const studio = await getCampaignStudio(campaignId);
      setState((currentState) => ({
        ...currentState,
        isLoading: false,
        studio,
      }));
    } catch (reloadError) {
      setState((currentState) => ({
        ...currentState,
        isLoading: false,
        error: toErrorMessage(reloadError, 'Unable to refresh campaign studio'),
      }));
    }
  };

  const addCommunicationTemplate = async (input: CreateCommunicationTemplateInput) => {
    if (!campaignId) {
      return false;
    }
    return performMutation(
      async () => {
        await createCommunicationTemplate(campaignId, input);
      },
      'Communication template added.'
    );
  };

  const addCommunicationSchedule = async (input: CreateCommunicationScheduleInput) => {
    if (!campaignId) {
      return false;
    }
    return performMutation(
      async () => {
        await createCommunicationSchedule(campaignId, input);
      },
      'Communication schedule added.'
    );
  };

  const persistMilestones = async (milestones: SaveCampaignMilestoneInput[]) => {
    if (!campaignId) {
      return false;
    }
    return performMutation(
      async () => {
        await saveCampaignMilestones(campaignId, milestones);
      },
      'Milestones saved.'
    );
  };

  const clearSaveMessage = () => {
    setState((currentState) => ({
      ...currentState,
      saveMessage: null,
    }));
  };

  const performMutation = async (
    mutate: () => Promise<void>,
    successMessage: string
  ) => {
    setState((currentState) => ({
      ...currentState,
      isSaving: true,
      error: null,
      saveMessage: null,
    }));

    try {
      await mutate();
      const studio = await getCampaignStudio(campaignId as string);
      setState({
        isLoading: false,
        isSaving: false,
        error: null,
        saveMessage: successMessage,
        studio,
      });
      return true;
    } catch (mutationError) {
      setState((currentState) => ({
        ...currentState,
        isSaving: false,
        error: toErrorMessage(mutationError, 'Unable to save campaign studio changes'),
        saveMessage: null,
      }));
      return false;
    }
  };

  return {
    ...state,
    reload,
    addCommunicationTemplate,
    addCommunicationSchedule,
    persistMilestones,
    clearSaveMessage,
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
