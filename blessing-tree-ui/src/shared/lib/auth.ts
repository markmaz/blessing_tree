const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'auth_userId';
const EMAIL_KEY = 'auth_email';
const AUTH_STORAGE_EVENT = 'blessing-tree-auth-storage';

export interface StoredAuth {
  token: string | null;
  userId: string | null;
  email: string | null;
}

function emitAuthStorageChange(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  emitAuthStorageChange();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(EMAIL_KEY);
  sessionStorage.clear();
  emitAuthStorageChange();
}

export function getStoredAuth(): StoredAuth {
  return {
    token: getToken(),
    userId: getUserId(),
    email: getEmail(),
  };
}

export function subscribeToAuthStorageChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || [TOKEN_KEY, USER_ID_KEY, EMAIL_KEY].includes(event.key)) {
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
