import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { routes } from '@/app/routes';
import { getPrefersFullSite, shouldUseMobileOperatorMode } from '@/features/mobile/model/mobileMode';

export function MobileAppRedirectGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [shouldRedirect, setShouldRedirect] = useState(() => getShouldRedirectToMobile());

  useEffect(() => {
    const updateRedirectState = () => {
      setShouldRedirect(getShouldRedirectToMobile());
    };

    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: none)');

    window.addEventListener('resize', updateRedirectState);
    window.addEventListener('orientationchange', updateRedirectState);

    if (pointerQuery.addEventListener) {
      pointerQuery.addEventListener('change', updateRedirectState);
      hoverQuery.addEventListener('change', updateRedirectState);
    } else {
      pointerQuery.addListener(updateRedirectState);
      hoverQuery.addListener(updateRedirectState);
    }

    updateRedirectState();

    return () => {
      window.removeEventListener('resize', updateRedirectState);
      window.removeEventListener('orientationchange', updateRedirectState);

      if (pointerQuery.removeEventListener) {
        pointerQuery.removeEventListener('change', updateRedirectState);
        hoverQuery.removeEventListener('change', updateRedirectState);
      } else {
        pointerQuery.removeListener(updateRedirectState);
        hoverQuery.removeListener(updateRedirectState);
      }
    };
  }, []);

  if (shouldRedirect) {
    return <Navigate to={routes.MOBILE} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function getShouldRedirectToMobile(): boolean {
  return shouldUseMobileOperatorMode() && !getPrefersFullSite();
}
