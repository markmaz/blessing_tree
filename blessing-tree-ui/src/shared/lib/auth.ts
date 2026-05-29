const LEGACY_TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'auth_userId';
const EMAIL_KEY = 'auth_email';
const ROLE_KEY = 'auth_role';
const AUTH_STORAGE_EVENT = 'blessing-tree-auth-storage';
let accessToken: string | null = null;

export interface StoredAuth {
  token: string | null;
  userId: string | null;
  email: string | null;
  role: string | null;
}

function emitAuthStorageChange(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string): void {
  accessToken = token;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  emitAuthStorageChange();
}

export function clearToken(): void {
  accessToken = null;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  emitAuthStorageChange();
}

export function getUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setUserId(userId: string): void {
  localStorage.setItem(USER_ID_KEY, userId);
  emitAuthStorageChange();
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function setEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email);
  emitAuthStorageChange();
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function setRole(role: string | null): void {
  if (!role) {
    localStorage.removeItem(ROLE_KEY);
  } else {
    localStorage.setItem(ROLE_KEY, role);
  }
  emitAuthStorageChange();
}

export function clearAuthStorage(): void {
  accessToken = null;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(ROLE_KEY);
  sessionStorage.clear();
  emitAuthStorageChange();
}

export function getStoredAuth(): StoredAuth {
  return {
    token: getToken(),
    userId: getUserId(),
    email: getEmail(),
    role: getRole(),
  };
}

export function subscribeToAuthStorageChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || [LEGACY_TOKEN_KEY, USER_ID_KEY, EMAIL_KEY, ROLE_KEY].includes(event.key)) {
      listener();
    }
  };

  window.addEventListener(AUTH_STORAGE_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(AUTH_STORAGE_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}
