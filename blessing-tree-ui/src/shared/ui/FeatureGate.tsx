import type { ReactNode } from 'react';
import { useAppFeatures } from '@/features/admin/model/appFeaturesContext';

export function FeatureGate({
  featureKey,
  fallback,
  children,
}: {
  featureKey: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { isFeatureEnabled } = useAppFeatures();
  if (!isFeatureEnabled(featureKey, true)) {
    return (
      fallback ?? (
        <div className="content-card">
          <h1 className="h4 mb-2">Feature Disabled</h1>
          <p className="text-muted mb-0">
            This feature is currently disabled by an administrator.
          </p>
        </div>
      )
    );
  }
  return <>{children}</>;
}
