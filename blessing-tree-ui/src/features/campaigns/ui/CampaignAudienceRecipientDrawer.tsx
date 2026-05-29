import '@/features/campaigns/ui/campaignStudioCommunications.css';
import type { CommunicationAudienceRecipientSummary } from '@/features/campaigns/model/campaignStudioTypes';

interface CampaignAudienceRecipientDrawerProps {
  audienceLabel: string;
  summary: CommunicationAudienceRecipientSummary | null;
  onClose: () => void;
}

export function CampaignAudienceRecipientDrawer({
  audienceLabel,
  summary,
  onClose,
}: CampaignAudienceRecipientDrawerProps) {
  const recipients = summary?.recipients ?? [];

  return (
    <div className="campaign-template-history-drawer" role="dialog" aria-modal="true" aria-label="Resolved recipients">
      <div className="campaign-template-history-drawer__backdrop" onClick={onClose} />
      <aside className="campaign-template-history-drawer__panel">
        <div className="campaign-template-history-drawer__header">
          <div>
            <div className="small text-uppercase text-muted fw-semibold">Resolved Recipients</div>
            <h3 className="h5 mb-1">{audienceLabel}</h3>
            <div className="text-muted small">
              This is the audience that resolves right now from current campaign data.
            </div>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Close
          </button>
        </div>

        <div className="campaign-template-history-drawer__summary">
          <div>
            <span className="campaign-template-history-drawer__label">Audience</span>
            <strong>{audienceLabel}</strong>
          </div>
          <div>
            <span className="campaign-template-history-drawer__label">Recipients</span>
            <strong>{summary?.count ?? 0}</strong>
          </div>
        </div>

        {recipients.length === 0 ? (
          <div className="campaign-studio__empty-note mb-0">
            No recipients currently resolve for this audience.
          </div>
        ) : (
          <div className="campaign-template-history-drawer__recipient-list">
            {recipients.map((recipient) => (
              <div
                key={`${recipient.email}:${recipient.displayName}`}
                className="campaign-template-history-drawer__recipient"
              >
                <div>
                  <strong>{recipient.displayName}</strong>
                  <div className="text-muted small">{recipient.email}</div>
                </div>
                <span className="campaign-template-badge is-muted">resolved</span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
