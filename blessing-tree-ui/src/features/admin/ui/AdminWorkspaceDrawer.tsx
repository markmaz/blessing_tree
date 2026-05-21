import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface AdminWorkspaceDrawerProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: 'regular' | 'wide';
}

export function AdminWorkspaceDrawer({
  isOpen,
  title,
  description,
  onClose,
  children,
  width = 'regular',
}: AdminWorkspaceDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="admin-users-drawer-layer">
      <button
        type="button"
        className="admin-users-drawer__backdrop"
        aria-label="Close drawer backdrop"
        onClick={onClose}
      />
      <aside
        className={`admin-users-drawer admin-users-drawer--${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-users-drawer-title"
      >
        <header className="admin-users-drawer__header">
          <div>
            <h3 id="admin-users-drawer-title" className="h5 mb-1">
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
        <div className="admin-users-drawer__body">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
