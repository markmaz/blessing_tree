import type { GiftScanAction } from '@/features/gifts/model/giftSearchTypes';
import { scanActionIcon, scanActionLabel } from '@/features/mobile/model/mobileScanLabels';

type ScanDetail = {
  label: string;
  value: string;
};

type MobileGiftScanViewProps = {
  campaignName: string;
  labelCode: string;
  message: string | null;
  notice: string | null;
  error: string | null;
  isLoading: boolean;
  recipientDetails: ScanDetail[] | null;
  giftDetails: ScanDetail[] | null;
  actions: GiftScanAction[];
  notes: string;
  isSaving: boolean;
  onNotesChange: (value: string) => void;
  onAction: (action: GiftScanAction) => void;
};

export function MobileGiftScanView({
  campaignName,
  labelCode,
  message,
  notice,
  error,
  isLoading,
  recipientDetails,
  giftDetails,
  actions,
  notes,
  isSaving,
  onNotesChange,
  onAction,
}: MobileGiftScanViewProps) {
  return (
    <main className="mobile-public-scan">
      <div className="mobile-public-scan__shell">
        <header className="mobile-public-scan__header">
          <div className="mobile-shell__brand">
            <img
              src="/blessing_tree_logo_transparent_v3.png"
              alt="Blessing Tree"
              className="mobile-shell__logo"
            />
            <div className="mobile-shell__brand-text">
              <span className="mobile-shell__eyebrow">Gift Scan</span>
              <strong>{campaignName}</strong>
            </div>
          </div>
          <span className="mobile-public-scan__label">{labelCode || 'No label'}</span>
        </header>

        {message ? <MobileScanNotice tone="success" icon="bi-check2-circle" text={message} /> : null}
        {notice ? <MobileScanNotice tone="info" icon="bi-info-circle" text={notice} /> : null}
        {error ? <MobileScanNotice tone="danger" icon="bi-exclamation-triangle" text={error} /> : null}

        {isLoading && !giftDetails ? (
          <section className="mobile-lookup-card">
            <p className="mobile-muted">Loading gift label...</p>
          </section>
        ) : giftDetails ? (
          <>
            <MobileScanDetailCard title="Recipient" details={recipientDetails ?? []} />
            <MobileScanDetailCard title="Gift" details={giftDetails} />

            <section className="mobile-lookup-card">
              <div className="mobile-lookup-card__header">
                <div>
                  <span className="mobile-lookup-card__eyebrow">Workflow</span>
                  <h2>Available actions</h2>
                </div>
              </div>
              <label className="mobile-search-card__label" htmlFor="mobile-scan-notes">
                Notes
              </label>
              <textarea
                id="mobile-scan-notes"
                className="mobile-modal__textarea"
                rows={3}
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Optional"
              />
              <div className="mobile-scan-action-grid">
                {actions.length ? (
                  actions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={
                        action === 'EXCEPTION'
                          ? 'mobile-secondary-action mobile-secondary-action--danger'
                          : 'mobile-primary-action mobile-primary-action--inline'
                      }
                      disabled={isSaving}
                      onClick={() => onAction(action)}
                    >
                      <i className={`bi ${scanActionIcon(action)}`} aria-hidden="true" />
                      <span>{scanActionLabel(action)}</span>
                    </button>
                  ))
                ) : (
                  <p className="mobile-muted">No more actions are available for this gift.</p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function MobileScanNotice({
  tone,
  icon,
  text,
}: {
  tone: 'success' | 'danger' | 'info';
  icon: string;
  text: string;
}) {
  const toneClass = tone === 'info' ? '' : ` mobile-alert--${tone}`;
  return (
    <div className={`mobile-alert mobile-scan-notice${toneClass}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function MobileScanDetailCard({ title, details }: { title: string; details: ScanDetail[] }) {
  return (
    <section className="mobile-lookup-card">
      <div className="mobile-lookup-card__header">
        <div>
          <span className="mobile-lookup-card__eyebrow">{title}</span>
          <h2>{title} info</h2>
        </div>
      </div>
      <dl className="mobile-detail-grid">
        {details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
