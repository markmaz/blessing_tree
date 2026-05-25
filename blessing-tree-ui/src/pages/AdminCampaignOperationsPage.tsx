import { useEffect, useState } from 'react';
import { fetchCampaignOperations } from '@/features/admin/api/campaignOperationsApi';
import type { CampaignOperationsPayload } from '@/features/admin/model/campaignOperationsTypes';
import { AdminCampaignOperationsWorkspace } from '@/features/admin/ui/AdminCampaignOperationsWorkspace';

export function AdminCampaignOperationsPage() {
  const [payload, setPayload] = useState<CampaignOperationsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaignOperations = async () => {
    setError(null);
    try {
      setPayload(await fetchCampaignOperations());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load campaign operations.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCampaignOperations();
  }, []);

  if (isLoading) {
    return <div className="content-card">Loading campaign operations…</div>;
  }

  if (error) {
    return (
      <div className="content-card">
        <div className="alert alert-danger mb-0">{error}</div>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  return (
    <AdminCampaignOperationsWorkspace
      milestoneDefinitions={payload.milestoneDefinitions}
      readinessRules={payload.readinessRules}
      options={payload.options}
      onDataChanged={loadCampaignOperations}
    />
  );
}
