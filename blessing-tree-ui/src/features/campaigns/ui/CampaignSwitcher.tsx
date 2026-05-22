import { useNavigate } from 'react-router-dom';
import { buildCampaignDetailPath, routes } from '@/app/routes';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import '@/features/campaigns/ui/campaigns.css';

export function CampaignSwitcher() {
  const navigate = useNavigate();
  const {
    campaigns,
    isLoading,
    error,
    selectedCampaignId,
    selectCampaign,
  } = useCampaigns();

  const handleChange = (campaignId: string) => {
    selectCampaign(campaignId || null);
    if (campaignId) {
      navigate(buildCampaignDetailPath(campaignId));
    }
  };

  return (
    <div className="campaign-switcher">
      <div className="campaign-switcher-controls">
        <label className="campaign-switcher-label" htmlFor="campaign-switcher">
          <i className="bi bi-stars" aria-hidden="true" />
          <span>Campaign</span>
        </label>
        <select
          id="campaign-switcher"
          className="form-select form-select-sm campaign-switcher-select"
          value={selectedCampaignId ?? ''}
          onChange={(event) => handleChange(event.target.value)}
          disabled={isLoading || campaigns.length === 0}
        >
          <option value="">
            {isLoading ? 'Loading campaigns...' : 'Choose a campaign'}
          </option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} ({campaign.year})
            </option>
          ))}
        </select>
      </div>
      {!selectedCampaignId && !isLoading ? (
        <button
          type="button"
          className="btn btn-outline-light btn-sm campaign-switcher-manage"
          onClick={() => navigate(routes.CAMPAIGNS)}
        >
          <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
          <span>Open Campaigns</span>
        </button>
      ) : null}
      {error ? <div className="campaign-switcher-error">{error}</div> : null}
    </div>
  );
}
