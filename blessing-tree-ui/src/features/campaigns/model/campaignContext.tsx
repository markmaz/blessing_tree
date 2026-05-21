/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/authContext';
import { listCampaigns } from '@/features/campaigns/api/campaignApi';
import {
  clearStoredSelectedCampaignId,
  getStoredSelectedCampaignId,
  setStoredSelectedCampaignId,
} from '@/features/campaigns/model/campaignStorage';
import type { CampaignListItem } from '@/features/campaigns/model/campaignTypes';

interface CampaignContextValue {
  campaigns: CampaignListItem[];
  isLoading: boolean;
  error: string | null;
  selectedCampaignId: string | null;
  selectedCampaign: CampaignListItem | null;
  reloadCampaigns: () => Promise<void>;
  selectCampaign: (campaignId: string | null) => void;
}

const CampaignContext = createContext<CampaignContextValue | undefined>(undefined);

function resolveSelectedCampaignId(
  userId: string | null,
  campaigns: CampaignListItem[],
  currentSelectedCampaignId: string | null
): string | null {
  const preferredCampaignId =
    currentSelectedCampaignId ?? getStoredSelectedCampaignId(userId);

  if (
    preferredCampaignId &&
    campaigns.some((campaign) => campaign.id === preferredCampaignId)
  ) {
    return preferredCampaignId;
  }

  return campaigns[0]?.id ?? null;
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { bootstrapped, isAuthenticated, userId } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    if (!isAuthenticated) {
      setCampaigns([]);
      setSelectedCampaignId(null);
      setError(null);
      clearStoredSelectedCampaignId(userId);
      return;
    }

    let cancelled = false;

    const loadCampaigns = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextCampaigns = await listCampaigns();
        if (cancelled) {
          return;
        }

        setCampaigns(nextCampaigns);
        setSelectedCampaignId((currentSelectedCampaignId) => {
          const nextSelectedCampaignId = resolveSelectedCampaignId(
            userId,
            nextCampaigns,
            currentSelectedCampaignId
          );
          setStoredSelectedCampaignId(userId, nextSelectedCampaignId);
          return nextSelectedCampaignId;
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load campaigns';
        setCampaigns([]);
        setSelectedCampaignId(null);
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCampaigns();

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, isAuthenticated, userId]);

  const reloadCampaigns = async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextCampaigns = await listCampaigns();
      setCampaigns(nextCampaigns);
      setSelectedCampaignId((currentSelectedCampaignId) => {
        const nextSelectedCampaignId = resolveSelectedCampaignId(
          userId,
          nextCampaigns,
          currentSelectedCampaignId
        );
        setStoredSelectedCampaignId(userId, nextSelectedCampaignId);
        return nextSelectedCampaignId;
      });
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load campaigns';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectCampaign = (campaignId: string | null) => {
    setSelectedCampaignId(campaignId);
    setStoredSelectedCampaignId(userId, campaignId);
  };

  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;

  return (
    <CampaignContext.Provider
      value={{
        campaigns,
        isLoading,
        error,
        selectedCampaignId,
        selectedCampaign,
        reloadCampaigns,
        selectCampaign,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaigns(): CampaignContextValue {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaigns must be used within a CampaignProvider');
  }
  return context;
}
