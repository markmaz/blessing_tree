import { useEffect, useState } from 'react';
import { getBackendVersion } from '@/shared/api/metaApi';

const FRONTEND_VERSION = __APP_VERSION__;

export function AppFooter() {
  const [backendVersion, setBackendVersion] = useState<string>('loading');
  const backendLabel = backendVersion === 'unavailable'
    ? 'Backend unavailable'
    : `Backend v${backendVersion}`;

  useEffect(() => {
    let isActive = true;

    const loadBackendVersion = async () => {
      try {
        const version = await getBackendVersion();
        if (isActive) {
          setBackendVersion(version);
        }
      } catch {
        if (isActive) {
          setBackendVersion('unavailable');
        }
      }
    };

    void loadBackendVersion();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <span className="app-footer__copyright">
          © {new Date().getFullYear()} QueryForge, LLC
        </span>
        <span className="app-footer__versions">
          Frontend v{FRONTEND_VERSION} | {backendLabel}
        </span>
      </div>
    </footer>
  );
}
