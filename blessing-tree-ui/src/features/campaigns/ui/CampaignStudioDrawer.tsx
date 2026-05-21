import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface CampaignStudioDrawerProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: 'regular' | 'wide';
}

export function CampaignStudioDrawer({
  isOpen,
  title,
  description,
  onClose,
  children,
  width = 'regular',
}: CampaignStudioDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="campaign-team-drawer-layer">
      <button
        type="button"
        className="campaign-team-drawer__backdrop"
        aria-label="Close drawer backdrop"
        onClick={onClose}
      />
      <aside
        className={`campaign-team-drawer campaign-team-drawer--${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-team-drawer-title"
      >
        <header className="campaign-team-drawer__header">
          <div>
            <h3 id="campaign-team-drawer-title" className="h5 mb-1">
              {title}
            </h3>
            {description ? <p className="text-muted mb-0">{description}</p> : null}
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="campaign-team-drawer__body">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
