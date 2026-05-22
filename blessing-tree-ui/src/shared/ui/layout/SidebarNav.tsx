import { useMemo, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  buildCampaignPeopleDirectoryPath,
  buildCampaignPeopleIntakePath,
  routes,
} from '@/app/routes';
import { useAppFeatures } from '@/features/admin/model/appFeaturesContext';
import { useAuth } from '@/features/auth/model/authContext';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import { isAppAdminRole } from '@/features/campaigns/model/campaignPermissions';

interface SidebarNavProps {
  isOpen: boolean;
  onNavigate: () => void;
}

interface SidebarChildItem {
  label: string;
  to: string;
  icon: string;
}

interface SidebarItem {
  label: string;
  to: string;
  icon: string;
  end?: boolean;
  children?: SidebarChildItem[];
}

const navItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    to: routes.HOME,
    icon: 'bi-speedometer2',
    end: true,
  },
  {
    label: 'Campaigns',
    to: routes.CAMPAIGNS,
    icon: 'bi-stars',
  },
  {
    label: 'People',
    to: routes.CAMPAIGNS,
    icon: 'bi-people',
    children: [
      {
        label: 'Intake',
        to: routes.CAMPAIGNS,
        icon: 'bi-clipboard-plus',
      },
      {
        label: 'Directory',
        to: routes.CAMPAIGNS,
        icon: 'bi-search',
      },
    ],
  },
  {
    label: 'Donations',
    to: routes.DONATIONS,
    icon: 'bi-cash-stack',
  },
  {
    label: 'Reports',
    to: routes.REPORTS,
    icon: 'bi-clipboard-data',
  },
  {
    label: 'Admin',
    to: routes.ADMIN,
    icon: 'bi-gear',
    children: [
      {
        label: 'User Management',
        to: routes.ADMIN_USERS,
        icon: 'bi-people-fill',
      },
      {
        label: 'LLM Configuration',
        to: routes.ADMIN_LLM,
        icon: 'bi-cpu',
      },
      {
        label: 'Health Check',
        to: routes.ADMIN_HEALTH,
        icon: 'bi-heart-pulse',
      },
      {
        label: 'App Capabilities',
        to: routes.ADMIN_CAPABILITIES,
        icon: 'bi-toggles2',
      },
    ],
  },
];

export function SidebarNav({ isOpen, onNavigate }: SidebarNavProps) {
  const location = useLocation();
  const { role } = useAuth();
  const { isFeatureEnabled } = useAppFeatures();
  const { selectedCampaignId } = useCampaigns();
  const locationCampaignId = (() => {
    const match = location.pathname.match(/^\/campaigns\/([^/]+)/);
    return match?.[1] ?? null;
  })();
  const resolvedCampaignId = selectedCampaignId ?? locationCampaignId;
  const resolvedNavItems = useMemo(
    () =>
      navItems.map((item) =>
        item.label === 'People'
          ? {
              ...item,
              to: resolvedCampaignId ? buildCampaignPeopleIntakePath(resolvedCampaignId) : routes.CAMPAIGNS,
              children: item.children?.map((child) => ({
                ...child,
                to: resolvedCampaignId
                  ? child.label === 'Directory'
                    ? buildCampaignPeopleDirectoryPath(resolvedCampaignId)
                    : buildCampaignPeopleIntakePath(resolvedCampaignId)
                  : routes.CAMPAIGNS,
              })),
            }
          : item
      ),
    [resolvedCampaignId]
  );
  const visibleItems = resolvedNavItems.filter((item) => {
    if (item.label === 'People') return isFeatureEnabled('people');
    if (item.to === routes.DONATIONS) return isFeatureEnabled('donations');
    if (item.to === routes.REPORTS) return isFeatureEnabled('reports');
    if (item.to === routes.ADMIN) return isAppAdminRole(role);
    return true;
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const defaultExpandedGroups = useMemo(
    () => getDefaultExpandedGroups(location.pathname, resolvedNavItems),
    [location.pathname, resolvedNavItems]
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((currentValue) => ({
      ...currentValue,
      [label]: !(currentValue[label] ?? defaultExpandedGroups[label] ?? false),
    }));
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar-header">
        <Link to={routes.HOME} className="sidebar-brand" onClick={onNavigate}>
          <img
            src="/blessing-tree-logo.png"
            alt="Blessing Tree logo"
            className="sidebar-logo"
          />
        </Link>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <div key={item.label} className="sidebar-nav-group">
            {item.label === 'People' && !resolvedCampaignId ? null : item.children?.length ? (
              (() => {
                const isExpanded = expandedGroups[item.label] ?? defaultExpandedGroups[item.label] ?? false;

                return (
                  <>
                <button
                  type="button"
                  className={`sidebar-link sidebar-link--toggle nav-link ${
                    isSidebarItemActive(item, location.pathname) ? 'active' : ''
                  }`}
                  onClick={() => toggleGroup(item.label)}
                  aria-expanded={isExpanded}
                >
                  <span className="sidebar-link__content">
                    <i className={`bi ${item.icon}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                  <i
                    className={`bi ${
                      isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'
                    } sidebar-link__chevron`}
                    aria-hidden="true"
                  />
                </button>
                {isExpanded ? (
                  <div className="sidebar-subnav">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end
                        className={({ isActive }) =>
                          `sidebar-sublink nav-link ${isActive ? 'active' : ''}`
                        }
                        onClick={onNavigate}
                      >
                        <span className="sidebar-link__content">
                          <i className={`bi ${child.icon}`} aria-hidden="true" />
                          <span>{child.label}</span>
                        </span>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
                  </>
                );
              })()
            ) : (
              <NavLink
                to={item.to}
                end={item.end}
                className={() =>
                  `sidebar-link nav-link ${isSidebarItemActive(item, location.pathname) ? 'active' : ''}`
                }
                onClick={onNavigate}
              >
                <span className="sidebar-link__content">
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-card">
          <div className="text-uppercase small">Season Theme</div>
          <div className="fw-semibold">Grace &amp; Renewal</div>
        </div>
      </div>
    </aside>
  );
}

function getDefaultExpandedGroups(pathname: string, items: SidebarItem[]) {
  return items.reduce<Record<string, boolean>>((accumulator, item) => {
    if (item.children?.length) {
      accumulator[item.label] = isSidebarItemActive(item, pathname);
    }
    return accumulator;
  }, {});
}

function isSidebarItemActive(item: SidebarItem, pathname: string) {
  if (item.children?.length) {
    return item.children.some((child) => pathname === child.to);
  }

  if (item.label === 'Dashboard') {
    return pathname === routes.HOME;
  }

  if (item.label === 'Campaigns') {
    return (
      pathname === routes.CAMPAIGNS ||
      (/^\/campaigns\/[^/]+$/.test(pathname) && !pathname.includes('/people')) ||
      /^\/campaigns\/[^/]+\/studio$/.test(pathname)
    );
  }

  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}
