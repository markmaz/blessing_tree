import { useEffect, useState } from 'react';
import {
  getCampaign,
  getCampaignAccess,
  getCampaignSummary,
} from '@/features/campaigns/api/campaignApi';
import type {
  Campaign,
  CampaignAccess,
  CampaignSummary,
} from '@/features/campaigns/model/campaignTypes';

interface CampaignOverviewState {
  isLoading: boolean;
  error: string | null;
  campaign: Campaign | null;
  access: CampaignAccess | null;
  summary: CampaignSummary | null;
  reload: () => Promise<void>;
}

const emptyOverviewState: CampaignOverviewState = {
  isLoading: false,
  error: null,
  campaign: null,
  access: null,
  summary: null,
  reload: async () => {},
};

export function useCampaignOverview(campaignId: string | null): CampaignOverviewState {
  const [state, setState] = useState<CampaignOverviewState>(emptyOverviewState);

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
        const [campaign, access, summary] = await Promise.all([
          getCampaign(campaignId),
          getCampaignAccess(campaignId),
          getCampaignSummary(campaignId),
        ]);

        if (cancelled) {
          return;
        }

        setState({
          isLoading: false,
          error: null,
          campaign,
          access,
          summary,
          reload: load,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load campaign details';

        setState({
          isLoading: false,
          error: message,
          campaign: null,
          access: null,
          summary: null,
          reload: load,
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  return campaignId ? state : emptyOverviewState;
}
