/**
 * Authentication API client.
 * Uses backend routes from blessing-tree-api/app/routes/auth_routes.py.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000').replace(
  /\/+$/,
  ''
);
const AUTH_BASE_PATH = '/api/v1/auth';

export interface LoginResponse {
  userId: string;
  email: string;
  token: string;
  role: string | null;
}

export interface SessionResponse {
  userId: string;
  email: string;
  token: string;
  role: string | null;
}

interface LocalLoginApiResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TokenClaims {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
}

function authUrl(path: string): string {
  return `${API_BASE_URL}${AUTH_BASE_PATH}${path}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
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
    const fallback = `Request failed (${response.status})`;
    throw new Error(readErrorMessage(payload, fallback));
  }

  return payload as T;
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return atob(padded);
}

function getUserIdFromToken(token: string): string | null {
  try {
    const payload = getTokenClaims(token);
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function getEmailFromToken(token: string): string | null {
  try {
    const payload = getTokenClaims(token);
    return typeof payload.email === 'string' && payload.email ? payload.email : null;
  } catch {
    return null;
  }
}

function getRoleFromToken(token: string): string | null {
  try {
    const payload = getTokenClaims(token);
    return typeof payload.role === 'string' && payload.role ? payload.role : null;
  } catch {
    return null;
  }
}

function getTokenClaims(token: string): TokenClaims {
  const tokenParts = token.split('.');
  if (tokenParts.length < 2) {
    throw new Error('Invalid token');
  }

  const payloadRaw = decodeBase64Url(tokenParts[1]);
  return JSON.parse(payloadRaw) as TokenClaims;
}

/**
 * Local login route: POST /api/v1/auth/local/login.
 * The backend sets the refresh cookie and returns the access token payload.
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const response = await fetch(authUrl('/local/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJsonResponse<LocalLoginApiResponse>(response);

  if (!payload.access_token) {
    throw new Error('Login response did not include access token');
  }

  const userId = getUserIdFromToken(payload.access_token) ?? email;

  return {
    userId,
    email,
    token: payload.access_token,
    role: getRoleFromToken(payload.access_token),
  };
}

/**
 * Local logout helper.
 * Calls the backend logout route so the refresh cookie is also revoked.
 */
export async function logout(token?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(authUrl('/logout'), {
    method: 'POST',
    credentials: 'include',
    headers,
  });

  if (!response.ok && response.status !== 204) {
    const fallback = `Logout failed (${response.status})`;
    const bodyText = await response.text();
    let payload: unknown = null;
    if (bodyText) {
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = null;
      }
    }
    throw new Error(readErrorMessage(payload, fallback));
  }
}

export async function refreshSession(): Promise<SessionResponse> {
  const response = await fetch(authUrl('/refresh'), {
    method: 'POST',
    credentials: 'include',
  });

  const payload = await parseJsonResponse<LocalLoginApiResponse>(response);

  if (!payload.access_token) {
    throw new Error('Refresh response did not include access token');
  }

  return {
    userId: getUserIdFromToken(payload.access_token) ?? '',
    email: getEmailFromToken(payload.access_token) ?? '',
    token: payload.access_token,
    role: getRoleFromToken(payload.access_token),
  };
}
