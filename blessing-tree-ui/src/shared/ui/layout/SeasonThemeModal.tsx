import type { CampaignSeasonReflection } from '@/features/campaigns/model/campaignTypes';

interface SeasonThemeModalProps {
  open: boolean;
  campaignName: string;
  seasonTheme: string | null;
  isLoading: boolean;
  error: string | null;
  reflection: CampaignSeasonReflection | null;
  onClose: () => void;
}

export function SeasonThemeModal({
  open,
  campaignName,
  seasonTheme,
  isLoading,
  error,
  reflection,
  onClose,
}: SeasonThemeModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="season-theme-modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="season-theme-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Season Theme Reflection"
        aria-labelledby="season-theme-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="season-theme-modal__header">
          <div>
            <div className="season-theme-modal__eyebrow">
              <i className="bi bi-stars" aria-hidden="true" />
              <span>Season Theme Reflection</span>
            </div>
            <h3 id="season-theme-modal-title" className="h5 mb-1">
              {seasonTheme || 'General Blessing Tree Reflection'}
            </h3>
            <p className="mb-0 text-muted">{campaignName}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
            <span className="ms-2">Close</span>
          </button>
        </div>

        {isLoading ? (
          <div className="season-theme-modal__loading">
            <i className="bi bi-hourglass-split" aria-hidden="true" />
            <span>Finding a scripture passage and prayer for this theme…</span>
          </div>
        ) : error ? (
          <div className="alert alert-danger mb-0" role="alert">
            {error}
          </div>
        ) : reflection ? (
          <div className="season-theme-modal__body">
            <section className="season-theme-modal__card">
              <div className="season-theme-modal__card-heading">
                <i className="bi bi-book" aria-hidden="true" />
                <span>Scripture</span>
              </div>
              <blockquote className="season-theme-modal__quote">
                “{reflection.verse.text}”
              </blockquote>
              <div className="season-theme-modal__citation">
                {reflection.verse.reference} · {reflection.verse.translation}
              </div>
            </section>

            <section className="season-theme-modal__card">
              <div className="season-theme-modal__card-heading">
                <i className="bi bi-heart" aria-hidden="true" />
                <span>Prayer</span>
              </div>
              <p className="season-theme-modal__prayer">{reflection.prayer.text}</p>
              <div className="season-theme-modal__citation">
                {reflection.prayer.title} · {reflection.prayer.citation}
              </div>
            </section>

            <div className="season-theme-modal__meta">
              <span className="season-theme-modal__meta-pill">
                <i className="bi bi-cross" aria-hidden="true" />
                <span>{reflection.source === 'llm' ? 'LLM-guided selection' : 'Verified fallback selection'}</span>
              </span>
              {reflection.fallbackReason ? (
                <span className="season-theme-modal__meta-note">
                  {reflection.fallbackReason}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
