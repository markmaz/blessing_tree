import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminHealth } from '@/features/admin/api/adminApi';
import type { AdminHealthPayload } from '@/features/admin/model/adminTypes';

const POLL_INTERVAL_MS = 30_000;

export function useAdminHealth() {
  const [health, setHealth] = useState<AdminHealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastCheckedRef = useRef<number>(Date.now());

  const load = useCallback(async () => {
    setError(null);
    try {
      const nextHealth = await fetchAdminHealth();
      lastCheckedRef.current = Date.now();
      setHealth(nextHealth);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load runtime health.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [load]);

  return {
    health,
    error,
    isLoading,
    lastChecked: lastCheckedRef.current,
    refreshNow: load,
  };
}
