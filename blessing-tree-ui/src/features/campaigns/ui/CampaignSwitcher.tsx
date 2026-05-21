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
  };

  const handleOpen = () => {
    if (!selectedCampaignId) {
      navigate(routes.CAMPAIGNS);
      return;
    }
    navigate(buildCampaignDetailPath(selectedCampaignId));
  };

  return (
    <div className="campaign-switcher">
      <label className="campaign-switcher-label" htmlFor="campaign-switcher">
        Campaign
      </label>
      <div className="campaign-switcher-controls">
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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleOpen}
          disabled={!selectedCampaignId}
        >
          <i className="bi bi-box-arrow-up-right me-2" aria-hidden="true" />
          Open
        </button>
      </div>
      {error ? <div className="campaign-switcher-error">{error}</div> : null}
    </div>
  );
}
