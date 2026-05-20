import {
  clearAuthStorage,
  getStoredAuth,
  getToken,
  setEmail,
  setToken,
  setUserId,
} from '@/shared/lib/auth';
import { refreshSession } from '@/shared/api/authApi';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000').replace(
  /\/+$/,
  ''
);
const AUTH_BASE_PATH = '/api/v1/auth';

let refreshPromise: Promise<string> | null = null;

export interface ApiRequestOptions extends RequestInit {
  retryOnUnauthorized?: boolean;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function isAuthPath(url: string): boolean {
  return url.includes(`${AUTH_BASE_PATH}/login`) || url.includes(`${AUTH_BASE_PATH}/refresh`);
}

async function refreshAccessToken(): Promise<string> {
  const session = await refreshSession();
  setUserId(session.userId);
  setEmail(session.email);
  setToken(session.token);
  return session.token;
}

async function getRefreshedAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { retryOnUnauthorized = true, headers, ...init } = options;
  const url = buildUrl(path);
  const auth = getStoredAuth();
  const requestHeaders = new Headers(headers ?? {});

  if (auth.token && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${auth.token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers: requestHeaders,
    credentials: 'include',
  });

  if (
    response.status !== 401 ||
    !retryOnUnauthorized ||
    isAuthPath(url)
  ) {
    return response;
  }

  try {
    const refreshedToken = await getRefreshedAccessToken();
    const retryHeaders = new Headers(headers ?? {});
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);

    return await fetch(url, {
      ...init,
      headers: retryHeaders,
      credentials: 'include',
    });
  } catch {
    clearAuthStorage();
    return response;
  }
}

export async function apiFetchJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const bodyText = await response.text();

  let payload: unknown = null;
  if (bodyText) {
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if (payload && typeof payload === 'object') {
      const error = (payload as { error?: unknown }).error;
      const detail = (payload as { message?: unknown }).message;
      if (typeof error === 'string' && error.trim()) {
        message = error;
      } else if (typeof detail === 'string' && detail.trim()) {
        message = detail;
      }
    }
    throw new Error(message);
  }

  return payload as T;
}

export function getApiAccessToken(): string | null {
  return getToken();
}
