import type { ReactNode } from 'react';

interface WorkspaceSectionHeaderProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function WorkspaceSectionHeader({
  title,
  description,
  meta,
  actions,
  className,
}: WorkspaceSectionHeaderProps) {
  return (
    <div className={['app-section-header', className].filter(Boolean).join(' ')}>
      <div className="app-section-header__copy">
        <h2 className="h5 mb-1">{title}</h2>
        {meta ? <div className="app-section-header__meta">{meta}</div> : null}
        {description ? <p className="text-muted mb-0">{description}</p> : null}
      </div>
      {actions ? <div className="app-section-header__actions">{actions}</div> : null}
    </div>
  );
}
