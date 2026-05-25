import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useParams } from 'react-router-dom';
import {
  buildCampaignStudioPath,
  buildPublicCampaignSponsorPath,
} from '@/app/routes';
import { getCampaign } from '@/features/campaigns/api/campaignApi';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';
import '@/features/campaigns/ui/publicSponsors.css';

export function CampaignSponsorFlyerPage() {
  const { campaignId = '' } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    async function load() {
      try {
        const response = await getCampaign(campaignId);
        if (isActive) {
          setCampaign(response);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load sponsor flyer.');
        }
      }
    }
    void load();
    return () => {
      isActive = false;
    };
  }, [campaignId]);

  const publicUrl = useMemo(() => {
    if (!campaign?.publicSponsorSlug) {
      return null;
    }
    return `${window.location.origin}${buildPublicCampaignSponsorPath(campaign.publicSponsorSlug)}`;
  }, [campaign]);

  if (error) {
    return (
      <section className="campaign-page-stack">
        <div className="alert alert-danger" role="alert">{error}</div>
      </section>
    );
  }

  if (!campaign) {
    return <p className="text-muted">Loading sponsor flyer...</p>;
  }

  return (
    <section className="campaign-page-stack">
      <div className="public-sponsor-flyer__actions">
        <Link to={buildCampaignStudioPath(campaign.id)} className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left-circle me-2" aria-hidden="true" />
          Back to Studio
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
          <i className="bi bi-printer me-2" aria-hidden="true" />
          Print Flyer
        </button>
      </div>

      <div className="public-sponsor-flyer">
        {!publicUrl ? (
          <div className="alert alert-warning mb-0" role="alert">
            Public sponsor signup needs a sponsor slug before this flyer can be generated.
          </div>
        ) : (
          <div className="public-sponsor-flyer__grid">
            <div>
              <div className="text-uppercase small text-muted fw-semibold mb-2">Blessing Tree Sponsor Invitation</div>
              <h1 className="display-6 mb-3">{campaign.name}</h1>
              <p className="lead mb-3">
                Sponsor up to three gifts for this campaign through our public sponsor page.
              </p>
              {campaign.seasonTheme ? (
                <p className="mb-3">
                  <strong>Campaign Purpose:</strong> {campaign.seasonTheme}
                </p>
              ) : null}
              <ul className="mb-3">
                <li>Choose whole gift items only.</li>
                <li>Verify your email to reserve your selections.</li>
                <li>Bring the gifts back before the campaign gift deadline.</li>
              </ul>
              <p className="mb-2 fw-semibold">Scan the QR code or use this link:</p>
              <p className="mb-0"><a href={publicUrl}>{publicUrl}</a></p>
            </div>

            <div className="text-center">
              <div className="public-sponsor-qr">
                <QRCodeSVG value={publicUrl} size={260} includeMargin />
              </div>
              <p className="text-muted small mt-3 mb-0">
                Scan to open the sponsor registration page for {campaign.year}.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
