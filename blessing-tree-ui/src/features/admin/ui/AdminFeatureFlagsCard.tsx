import { updateFeatureFlag } from '@/features/admin/api/adminApi';
import { useAppFeatures } from '@/features/admin/model/appFeaturesContext';
import type { AdminFeatureFlag } from '@/features/admin/model/adminTypes';
import { useState } from 'react';

export function AdminFeatureFlagsCard() {
  const { features, updateFeatureInState } = useAppFeatures();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (feature: AdminFeatureFlag) => {
    setSavingKey(feature.featureKey);
    setError(null);
    try {
      const nextFeature = await updateFeatureFlag(feature.featureKey, !feature.isEnabled);
      updateFeatureInState(nextFeature);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update feature flag.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="content-card h-100">
      <h2 className="h5 mb-1">App Capabilities</h2>
      <p className="text-muted mb-3">
        Enable or disable major application surfaces without changing code or navigation.
      </p>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      <div className="vstack gap-3">
        {features.map((feature) => (
          <div
            key={feature.featureKey}
            className="d-flex align-items-start justify-content-between gap-3 border rounded-3 p-3 bg-white"
          >
            <div>
              <div className="fw-semibold">{feature.label}</div>
              <div className="text-muted small">{feature.description}</div>
            </div>
            <div className="form-check form-switch mt-1">
              <input
                className="form-check-input"
                type="checkbox"
                checked={feature.isEnabled}
                disabled={savingKey === feature.featureKey}
                onChange={() => void toggle(feature)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
