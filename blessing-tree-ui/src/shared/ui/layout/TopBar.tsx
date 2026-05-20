import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampaignSwitcher } from '@/features/campaigns/ui/CampaignSwitcher';
import { useAuth } from '@/features/auth/model/authContext';
import { logout as logoutRequest } from '@/shared/api/authApi';
import { routes } from '@/app/routes';

interface TopBarProps {
  pageTitle: string;
  onToggleSidebar: () => void;
}

export function TopBar({ pageTitle, onToggleSidebar }: TopBarProps) {
  const navigate = useNavigate();
  const { email, logout, token } = useAuth();

  const displayEmail = email ?? 'account@blessingtree.org';
  const initials = useMemo(
    () => (displayEmail ? displayEmail[0].toUpperCase() : 'B'),
    [displayEmail]
  );

  const handleSignOut = async () => {
    try {
      await logoutRequest(token);
    } catch {
      // Clear local auth state even if backend cookie revocation fails.
    }
    logout();
    navigate(routes.LOGIN);
  };

  return (
    <header className="app-topbar">
      <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="btn btn-outline-light btn-sm d-lg-none"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <i className="bi bi-list" aria-hidden="true" />
          </button>
          <span className="app-page-title">{pageTitle}</span>
        </div>

        <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3 ms-xl-auto">
          <CampaignSwitcher />

          <div className="dropdown align-self-start align-self-lg-center">
            <button
              className="btn btn-link text-decoration-none dropdown-toggle d-flex align-items-center gap-2"
              id="accountDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              type="button"
            >
              <span className="avatar-circle" aria-hidden="true">
                {initials}
              </span>
              <span className="d-none d-md-inline text-white-50">
                {displayEmail}
              </span>
            </button>
            <ul
              className="dropdown-menu dropdown-menu-end shadow"
              aria-labelledby="accountDropdown"
            >
              <li>
                <button type="button" className="dropdown-item">
                  Profile
                </button>
              </li>
              <li>
                <button type="button" className="dropdown-item">
                  Settings
                </button>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item text-danger"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
