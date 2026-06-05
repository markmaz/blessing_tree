import type { ReactNode } from 'react';

interface DrawerActionsProps {
  children: ReactNode;
  className?: string;
}

export function DrawerActions({ children, className }: DrawerActionsProps) {
  return (
    <div className={['campaign-team-drawer__actions', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
