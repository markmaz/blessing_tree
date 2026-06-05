import type { ReactNode } from 'react';

interface WorkspacePageHeaderProps {
  title: string;
  description?: string;
  chips?: ReactNode;
  actions?: ReactNode;
}

export function WorkspacePageHeader({
  title,
  description,
  chips,
  actions,
}: WorkspacePageHeaderProps) {
  return (
    <div className="app-page-header">
      <div className="app-page-header__copy">
        {chips ? <div className="app-page-header__chips">{chips}</div> : null}
        <h1 className="h3 mb-1">{title}</h1>
        {description ? <p className="text-muted mb-0">{description}</p> : null}
      </div>
      {actions ? <div className="app-page-header__actions">{actions}</div> : null}
    </div>
  );
}
