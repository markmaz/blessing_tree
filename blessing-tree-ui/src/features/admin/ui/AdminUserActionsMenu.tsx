import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { AdminUserWorkspaceRow } from '@/features/admin/model/adminUsersWorkspace';

interface AdminUserActionsMenuProps {
  row: AdminUserWorkspaceRow;
  onOpenDetails: (row: AdminUserWorkspaceRow) => void;
  onResendInvite: (invitationId: string) => void;
}

export function AdminUserActionsMenu({
  row,
  onOpenDetails,
  onResendInvite,
}: AdminUserActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return;
    }

    const boundingClientRect = buttonRef.current.getBoundingClientRect();
    setMenuStyle({
      top: boundingClientRect.bottom + window.scrollY + 6,
      left: boundingClientRect.right + window.scrollX - 192,
      position: 'absolute',
      zIndex: 1100,
      width: 192,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [isOpen]);

  const canResendInvite = row.latestInvitation?.status === 'pending';

  const menu = isOpen ? (
    <div
      ref={menuRef}
      className="admin-users-actions-menu"
      style={menuStyle}
    >
      <button
        type="button"
        className="admin-users-actions-menu__item"
        onClick={() => {
          setIsOpen(false);
          onOpenDetails(row);
        }}
      >
        <i className="bi bi-person-vcard me-2" aria-hidden="true" />
        View details
      </button>
      {canResendInvite ? (
        <button
          type="button"
          className="admin-users-actions-menu__item"
          onClick={() => {
            setIsOpen(false);
            onResendInvite(row.latestInvitation!.id);
          }}
        >
          <i className="bi bi-send me-2" aria-hidden="true" />
          Resend invite
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-light btn-sm admin-users-table__actions-toggle"
        aria-label={`Open actions for ${row.displayName}`}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <i className="bi bi-three-dots" aria-hidden="true" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
