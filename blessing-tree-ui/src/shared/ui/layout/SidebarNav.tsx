import { useMemo, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  buildCampaignAskPath,
  buildCampaignDetailPath,
  buildCampaignGiftsOperationsPath,
  buildCampaignGiftsPoolPath,
  buildCampaignGiftsReportsPath,
  buildCampaignGiftsSearchPath,
  buildCampaignGiftsTagBuilderPath,
  buildCampaignPeopleDirectoryPath,
  buildCampaignPeopleIntakePath,
  buildCampaignPeopleReportsPath,
  buildCampaignSponsorsDirectoryPath,
  buildCampaignSponsorsIntakePath,
  buildCampaignSponsorsReportsPath,
  buildCampaignSponsorFlyerPath,
  buildCampaignStudioPath,
  routes,
} from '@/app/routes';
import { useAppFeatures } from '@/features/admin/model/appFeaturesContext';
import { useAuth } from '@/features/auth/model/authContext';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import {
  canUseGiftOperations,
  canUseGiftPool,
  canUseGiftSearch,
  canManageCampaign,
  hasCampaignCapability,
  canViewPeople,
  canViewReports,
  canViewSponsors,
  isAppAdminRole,
} from '@/features/campaigns/model/campaignPermissions';

interface SidebarNavProps {
  isOpen: boolean;
  onNavigate: () => void;
  onOpenSeasonTheme?: () => void;
}

interface SidebarChildItem {
  label: string;
  to: string;
  icon: string;
  featureKey?: string;
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
    label: 'Ask Blessing Tree',
    to: routes.CAMPAIGNS,
    icon: 'bi-chat-square-text',
  },
  {
    label: 'Campaigns',
    to: routes.CAMPAIGNS,
    icon: 'bi-stars',
    children: [
      {
        label: 'Campaign Library',
        to: routes.CAMPAIGNS,
        icon: 'bi-collection',
      },
      {
        label: 'Overview',
        to: routes.CAMPAIGNS,
        icon: 'bi-bullseye',
      },
      {
        label: 'Studio',
        to: routes.CAMPAIGNS,
        icon: 'bi-sliders',
      },
      {
        label: 'Flyer Builder',
        to: routes.CAMPAIGNS,
        icon: 'bi-file-earmark-richtext',
      },
    ],
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
      {
        label: 'Reports',
        to: routes.CAMPAIGNS,
        icon: 'bi-clipboard-data',
        featureKey: 'reports',
      },
    ],
  },
  {
    label: 'Sponsors',
    to: routes.CAMPAIGNS,
    icon: 'bi-award',
    children: [
      {
        label: 'Intake',
        to: routes.CAMPAIGNS,
        icon: 'bi-person-plus',
      },
      {
        label: 'Directory',
        to: routes.CAMPAIGNS,
        icon: 'bi-search-heart',
      },
      {
        label: 'Reports',
        to: routes.CAMPAIGNS,
        icon: 'bi-clipboard2-pulse',
      },
    ],
  },
  {
    label: 'Gifts',
    to: routes.CAMPAIGNS,
    icon: 'bi-gift',
    children: [
      {
        label: 'Search',
        to: routes.CAMPAIGNS,
        icon: 'bi-search',
      },
      {
        label: 'Operations',
        to: routes.CAMPAIGNS,
        icon: 'bi-clipboard-check',
      },
      {
        label: 'Gift Pool',
        to: routes.CAMPAIGNS,
        icon: 'bi-box-seam',
      },
      {
        label: 'Gift Status',
        to: routes.CAMPAIGNS,
        icon: 'bi-clipboard2-pulse',
      },
      {
        label: 'Gift Tag Builder',
        to: routes.CAMPAIGNS,
        icon: 'bi-tags',
      },
    ],
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
        label: 'Ask Review',
        to: routes.ADMIN_ASK_REVIEW,
        icon: 'bi-chat-square-dots',
      },
      {
        label: 'Campaign Operations',
        to: routes.ADMIN_CAMPAIGN_OPERATIONS,
        icon: 'bi-signpost-split',
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

export function SidebarNav({ isOpen, onNavigate, onOpenSeasonTheme }: SidebarNavProps) {
  const location = useLocation();
  const { role } = useAuth();
  const { isFeatureEnabled } = useAppFeatures();
  const { campaigns = [], selectedCampaignId, selectedCampaign } = useCampaigns();
  const locationCampaignId = (() => {
    const match = location.pathname.match(/^\/campaigns\/([^/]+)/);
    return match?.[1] ?? null;
  })();
  const resolvedCampaignId = selectedCampaignId ?? locationCampaignId;
  const campaignAccess =
    campaigns.find((campaign) => campaign.id === resolvedCampaignId)?.userAccess ??
    (selectedCampaign?.id === resolvedCampaignId ? selectedCampaign.userAccess : null);
  const campaignAccessIsPending = Boolean(resolvedCampaignId && !campaignAccess);
  const canShowDuringCampaignLoad = (allowed: boolean) => campaignAccessIsPending || allowed;
  const resolvedNavItems = useMemo(
    () =>
      navItems.map((item) =>
        item.label === 'Campaigns'
          ? {
              ...item,
              children: item.children?.map((child) => ({
                ...child,
                to: resolvedCampaignId
                  ? child.label === 'Overview'
                    ? buildCampaignDetailPath(resolvedCampaignId)
                    : child.label === 'Studio'
                      ? buildCampaignStudioPath(resolvedCampaignId)
                      : child.label === 'Flyer Builder'
                        ? buildCampaignSponsorFlyerPath(resolvedCampaignId)
                        : routes.CAMPAIGNS
                  : routes.CAMPAIGNS,
              })),
            }
          : item.label === 'People'
          ? {
              ...item,
              to: resolvedCampaignId ? buildCampaignPeopleIntakePath(resolvedCampaignId) : routes.CAMPAIGNS,
              children: item.children?.map((child) => ({
                ...child,
                to: resolvedCampaignId
                  ? child.label === 'Directory'
                    ? buildCampaignPeopleDirectoryPath(resolvedCampaignId)
                    : child.label === 'Reports'
                      ? buildCampaignPeopleReportsPath(resolvedCampaignId)
                      : buildCampaignPeopleIntakePath(resolvedCampaignId)
                  : routes.CAMPAIGNS,
              })),
            }
          : item.label === 'Sponsors'
            ? {
                ...item,
                to: resolvedCampaignId ? buildCampaignSponsorsIntakePath(resolvedCampaignId) : routes.CAMPAIGNS,
                children: item.children?.map((child) => ({
                  ...child,
                  to: resolvedCampaignId
                    ? child.label === 'Directory'
                      ? buildCampaignSponsorsDirectoryPath(resolvedCampaignId)
                      : child.label === 'Reports'
                        ? buildCampaignSponsorsReportsPath(resolvedCampaignId)
                        : buildCampaignSponsorsIntakePath(resolvedCampaignId)
                    : routes.CAMPAIGNS,
                })),
              }
          : item.label === 'Gifts'
            ? {
                ...item,
                to: resolvedCampaignId ? buildCampaignGiftsSearchPath(resolvedCampaignId) : routes.CAMPAIGNS,
                children: item.children?.map((child) => ({
                  ...child,
                  to: resolvedCampaignId
                    ? child.label === 'Operations'
                      ? buildCampaignGiftsOperationsPath(resolvedCampaignId)
                      : child.label === 'Gift Pool'
                        ? buildCampaignGiftsPoolPath(resolvedCampaignId)
                        : child.label === 'Gift Status'
                          ? buildCampaignGiftsReportsPath(resolvedCampaignId)
                          : child.label === 'Gift Tag Builder'
                            ? buildCampaignGiftsTagBuilderPath(resolvedCampaignId)
                      : buildCampaignGiftsSearchPath(resolvedCampaignId)
                    : routes.CAMPAIGNS,
                })),
              }
          : item.label === 'Ask Blessing Tree'
            ? {
                ...item,
                to: resolvedCampaignId ? buildCampaignAskPath(resolvedCampaignId) : routes.CAMPAIGNS,
              }
          : item
      ),
    [resolvedCampaignId]
  );
  const visibleItems = resolvedNavItems.flatMap((item) => {
    const visibleChildren = item.children?.filter((child) => {
      if (child.featureKey && !isFeatureEnabled(child.featureKey)) {
        return false;
      }

      if (item.label === 'Campaigns') {
        if (child.label === 'Campaign Library') {
          return true;
        }
        return Boolean(resolvedCampaignId) && canShowDuringCampaignLoad(hasCampaignCapability(campaignAccess, 'campaign.view'));
      }

      if (item.label === 'People') {
        if (child.label === 'Reports') {
          return canShowDuringCampaignLoad(canViewReports(campaignAccess));
        }
        return canShowDuringCampaignLoad(canViewPeople(campaignAccess));
      }

      if (item.label === 'Sponsors') {
        if (child.label === 'Reports') {
          return canShowDuringCampaignLoad(canViewReports(campaignAccess));
        }
        return canShowDuringCampaignLoad(canViewSponsors(campaignAccess));
      }

      if (item.label === 'Gifts') {
        if (child.label === 'Search') {
          return isFeatureEnabled('sponsors') && canShowDuringCampaignLoad(canUseGiftSearch(campaignAccess));
        }
        if (child.label === 'Operations') {
          return isFeatureEnabled('sponsors') && canShowDuringCampaignLoad(canUseGiftOperations(campaignAccess));
        }
        if (child.label === 'Gift Pool') {
          return isFeatureEnabled('donations') && canShowDuringCampaignLoad(canUseGiftPool(campaignAccess));
        }
        if (child.label === 'Gift Status') {
          return isFeatureEnabled('reports') && canShowDuringCampaignLoad(canViewReports(campaignAccess));
        }
        if (child.label === 'Gift Tag Builder') {
          return isFeatureEnabled('sponsors') && canShowDuringCampaignLoad(canManageCampaign(campaignAccess));
        }
      }

      return true;
    });
    const visibleItem = {
      ...item,
      children: visibleChildren,
    };
    if (visibleItem.label === 'People') {
      return isFeatureEnabled('people') && visibleItem.children?.length ? [visibleItem] : [];
    }
    if (visibleItem.label === 'Sponsors') {
      return isFeatureEnabled('sponsors') && visibleItem.children?.length ? [visibleItem] : [];
    }
    if (visibleItem.label === 'Gifts') return visibleItem.children?.length ? [visibleItem] : [];
    if (visibleItem.label === 'Ask Blessing Tree') {
      return resolvedCampaignId && canShowDuringCampaignLoad(hasCampaignCapability(campaignAccess, 'campaign.view'))
        ? [visibleItem]
        : [];
    }
    if (item.to === routes.ADMIN) return isAppAdminRole(role) ? [visibleItem] : [];
    return [visibleItem];
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
            {(item.label === 'People' || item.label === 'Sponsors' || item.label === 'Gifts') && !resolvedCampaignId ? null : item.children?.length ? (
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
        <button
          type="button"
          className="sidebar-footer-card sidebar-footer-card--button"
          onClick={() => onOpenSeasonTheme?.()}
          disabled={!resolvedCampaignId || !selectedCampaign}
        >
          <span className="sidebar-footer-card__header">
            <span className="text-uppercase small">Season Theme</span>
            <i className="bi bi-chevron-up-right" aria-hidden="true" />
          </span>
          <span className="sidebar-footer-card__value">
            <i className="bi bi-book-half" aria-hidden="true" />
            <span>{selectedCampaign?.seasonTheme || 'Not set'}</span>
          </span>
        </button>
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
      (/^\/campaigns\/[^/]+$/.test(pathname) &&
        !pathname.includes('/people') &&
        !pathname.includes('/sponsors') &&
        !pathname.includes('/gifts') &&
        !pathname.includes('/ask')) ||
      /^\/campaigns\/[^/]+\/studio$/.test(pathname)
    );
  }

  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}
