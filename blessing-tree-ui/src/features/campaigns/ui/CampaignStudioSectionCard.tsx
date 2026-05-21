import type { ReactNode } from 'react';

interface CampaignStudioSectionCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  showHeader?: boolean;
}

export function CampaignStudioSectionCard({
  eyebrow,
  title,
  description,
  children,
  action,
  showHeader = true,
}: CampaignStudioSectionCardProps) {
  return (
    <section className="campaign-surface-card">
      {showHeader ? (
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div>
            <div className="campaign-studio__card-eyebrow">{eyebrow}</div>
            <h2 className="h5 mb-1">{title}</h2>
            {description ? <p className="text-muted mb-0">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
