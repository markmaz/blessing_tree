/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/model/authContext';
import { fetchFeatureFlags } from '@/features/admin/api/adminApi';
import type { AdminFeatureFlag } from '@/features/admin/model/adminTypes';

interface AppFeaturesContextValue {
  features: AdminFeatureFlag[];
  isLoading: boolean;
  isFeatureEnabled: (featureKey: string, defaultValue?: boolean) => boolean;
  refreshFeatures: () => Promise<void>;
  updateFeatureInState: (feature: AdminFeatureFlag) => void;
}

const DEFAULT_FEATURES: AdminFeatureFlag[] = [
  {
    featureKey: 'families',
    label: 'Families',
    description: '',
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    featureKey: 'donations',
    label: 'Donations',
    description: '',
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    featureKey: 'reports',
    label: 'Reports',
    description: '',
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    featureKey: 'campaign_ai',
    label: 'Campaign AI',
    description: '',
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
  },
];

const AppFeaturesContext = createContext<AppFeaturesContextValue | undefined>(undefined);

export function AppFeaturesProvider({ children }: { children: React.ReactNode }) {
  const { bootstrapped, isAuthenticated } = useAuth();
  const [features, setFeatures] = useState<AdminFeatureFlag[]>(DEFAULT_FEATURES);
  const [isLoading, setIsLoading] = useState(false);

  const refreshFeatures = useCallback(async () => {
    if (!bootstrapped || !isAuthenticated) {
      setFeatures(DEFAULT_FEATURES);
      return;
    }
    setIsLoading(true);
    try {
      const payload = await fetchFeatureFlags();
      setFeatures(payload.features);
    } catch {
      setFeatures(DEFAULT_FEATURES);
    } finally {
      setIsLoading(false);
    }
  }, [bootstrapped, isAuthenticated]);

  useEffect(() => {
    void refreshFeatures();
  }, [refreshFeatures]);

  const updateFeatureInState = useCallback((feature: AdminFeatureFlag) => {
    setFeatures((currentValue) => {
      const next = currentValue.filter((item) => item.featureKey !== feature.featureKey);
      next.push(feature);
      return next.sort((left, right) => left.label.localeCompare(right.label));
    });
  }, []);

  const isFeatureEnabled = useCallback(
    (featureKey: string, defaultValue = true) => {
      const feature = features.find((item) => item.featureKey === featureKey);
      return feature ? feature.isEnabled : defaultValue;
    },
    [features]
  );

  const value = useMemo(
    () => ({
      features,
      isLoading,
      isFeatureEnabled,
      refreshFeatures,
      updateFeatureInState,
    }),
    [features, isLoading, isFeatureEnabled, refreshFeatures, updateFeatureInState]
  );

  return <AppFeaturesContext.Provider value={value}>{children}</AppFeaturesContext.Provider>;
}

export function useAppFeatures(): AppFeaturesContextValue {
  const context = useContext(AppFeaturesContext);
  if (!context) {
    throw new Error('useAppFeatures must be used within AppFeaturesProvider');
  }
  return context;
}
