import type { ReactNode } from 'react';

interface DrawerSectionProps {
  title?: ReactNode;
  description?: string;
  actions?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DrawerSection({
  title,
  description,
  actions,
  header,
  children,
  className,
}: DrawerSectionProps) {
  return (
    <section className={['campaign-team-drawer__section', className].filter(Boolean).join(' ')}>
      {header ? (
        <div className="campaign-team-drawer__section-header">{header}</div>
      ) : title || description || actions ? (
        <div className="campaign-team-drawer__section-header">
          <div>
            {title ? <h4 className="h6 mb-1">{title}</h4> : null}
            {description ? <p className="text-muted mb-0">{description}</p> : null}
          </div>
          {actions ? <div className="campaign-team-drawer__section-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
