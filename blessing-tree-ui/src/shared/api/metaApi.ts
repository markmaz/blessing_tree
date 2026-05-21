import { apiFetchJson } from '@/shared/api/client';

interface BackendVersionResponse {
  backend_version: string;
}

export async function getBackendVersion(): Promise<string> {
  const response = await apiFetchJson<BackendVersionResponse>('/api/v1/meta/version');
  return response.backend_version;
}
