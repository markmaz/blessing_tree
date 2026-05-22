import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getCampaignSeasonReflection } from '@/features/campaigns/api/campaignApi';
import { useCampaigns } from '@/features/campaigns/model/campaignContext';
import type { CampaignSeasonReflection } from '@/features/campaigns/model/campaignTypes';
import { AppFooter } from './AppFooter';
import { SeasonThemeModal } from './SeasonThemeModal';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';

const DESKTOP_BREAKPOINT = 992;

const getIsDesktop = () =>
  window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;

const getPageTitle = (pathname: string) => {
  if (pathname.startsWith('/campaigns/') && pathname.endsWith('/studio')) {
    return 'Campaign Studio';
  }
  if (pathname.startsWith('/campaigns/') && pathname.includes('/people')) {
    return 'People';
  }
  if (pathname.startsWith('/campaigns')) return 'Campaigns';
  if (pathname.startsWith('/donations')) return 'Donations';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/admin')) return 'Admin';
  return 'Dashboard';
};

const MAX_RECENT_THEME_PAIRS = 10;

function seasonThemeStorageKey(campaignId: string) {
  return `bt-season-theme-recent:${campaignId}`;
}

function readRecentThemePairs(campaignId: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(seasonThemeStorageKey(campaignId));
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecentThemePairs(campaignId: string, pairIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(seasonThemeStorageKey(campaignId), JSON.stringify(pairIds.slice(0, MAX_RECENT_THEME_PAIRS)));
  } catch {
    // Ignore storage failures.
  }
}

export function AppLayout() {
  const location = useLocation();
  const { selectedCampaignId, selectedCampaign } = useCampaigns();
  const pageTitle = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname]
  );

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return getIsDesktop();
  });
  const [isSeasonThemeModalOpen, setIsSeasonThemeModalOpen] = useState(false);
  const [isSeasonThemeLoading, setIsSeasonThemeLoading] = useState(false);
  const [seasonThemeError, setSeasonThemeError] = useState<string | null>(null);
  const [seasonReflection, setSeasonReflection] = useState<CampaignSeasonReflection | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(
      `(min-width: ${DESKTOP_BREAKPOINT}px)`
    );

    const handleChange = (event: MediaQueryListEvent) => {
      setSidebarOpen(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleNavClick = () => {
    if (!getIsDesktop()) {
      setSidebarOpen(false);
    }
  };

  const handleOpenSeasonTheme = async () => {
    if (!selectedCampaignId || !selectedCampaign) {
      return;
    }

    setIsSeasonThemeModalOpen(true);
    setIsSeasonThemeLoading(true);
    setSeasonThemeError(null);

    try {
      const recentPairIds = readRecentThemePairs(selectedCampaignId);
      const nextReflection = await getCampaignSeasonReflection(selectedCampaignId, recentPairIds);
      setSeasonReflection(nextReflection);
      writeRecentThemePairs(selectedCampaignId, [nextReflection.pairId, ...recentPairIds.filter((pairId) => pairId !== nextReflection.pairId)]);
    } catch (loadError) {
      setSeasonReflection(null);
      setSeasonThemeError(
        loadError instanceof Error ? loadError.message : 'Unable to load season theme reflection.'
      );
    } finally {
      setIsSeasonThemeLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <SidebarNav
        isOpen={sidebarOpen}
        onNavigate={handleNavClick}
        onOpenSeasonTheme={() => void handleOpenSeasonTheme()}
      />

      <div className="app-main">
        <TopBar pageTitle={pageTitle} onToggleSidebar={handleToggleSidebar} />

        <main className="app-content">
          <div className="container-fluid py-4 px-4 px-lg-5">
            <Outlet />
          </div>
        </main>

        <AppFooter />
      </div>

      <button
        type="button"
        className={`app-sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close sidebar"
      >
        <i className="bi bi-x-lg visually-hidden" aria-hidden="true" />
      </button>

      <SeasonThemeModal
        open={isSeasonThemeModalOpen}
        campaignName={selectedCampaign?.name || 'Blessing Tree'}
        seasonTheme={selectedCampaign?.seasonTheme || null}
        isLoading={isSeasonThemeLoading}
        error={seasonThemeError}
        reflection={seasonReflection}
        onClose={() => setIsSeasonThemeModalOpen(false)}
      />
    </div>
  );
}
