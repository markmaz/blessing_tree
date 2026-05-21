/**
 * Layout Component
 * Main application layout with top navigation and content container.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/authContext';
import { logout as logoutRequest } from '@/shared/api/authApi';
import { routes } from '@/app/routes';
import './Layout.css';

export interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { logout, email, token } = useAuth();

  const handleLogout = async () => {
    try {
      await logoutRequest(token);
    } catch {
      // Clear local auth state even if backend cookie revocation fails.
    }
    logout();
    navigate(routes.LOGIN);
  };

  return (
    <div className="layout-wrapper">
      {/* Top Navigation */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light layout-navbar">
        <div className="container-fluid">
          <div className="navbar-brand fw-bold">
            Blessing Tree
          </div>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <span className="nav-link text-muted">
                  {email && `Logged in as ${email}`}
                </span>
              </li>
              <li className="nav-item">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
                  Sign Out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="layout-main">
        <div className="container-fluid layout-container">{children}</div>
      </main>

      {/* Footer (Optional) */}
      <footer className="layout-footer">
        <div className="container-fluid text-center text-muted small py-3">
          © {new Date().getFullYear()} Blessing Tree. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
