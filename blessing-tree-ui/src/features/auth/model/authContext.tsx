/* eslint-disable react-refresh/only-export-components */
/**
 * Auth Context and Provider.
 * Manages authentication state and provides auth functions throughout the app.
 * Uses React Context (lightweight) instead of Redux for simplicity.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getStoredAuth,
  setRole as storeRole,
  setToken as storeToken,
  setUserId as storeUserId,
  setEmail as storeEmail,
  clearAuthStorage,
  subscribeToAuthStorageChanges,
} from '@/shared/lib/auth';
import { refreshSession } from '@/shared/api/authApi';

export interface AuthState {
  bootstrapped: boolean;
  isAuthenticated: boolean;
  token: string | null;
  userId: string | null;
  email: string | null;
  role: string | null;
}

export interface AuthContextType extends AuthState {
  login: (userId: string, email: string, token: string, role: string | null) => void;
  restoreSession: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const storedAuth = getStoredAuth();

    return {
      bootstrapped: !!storedAuth.token,
      isAuthenticated: !!storedAuth.token,
      token: storedAuth.token,
      userId: storedAuth.userId,
      email: storedAuth.email,
      role: storedAuth.role,
    };
  });

  const login = useCallback((userId: string, email: string, token: string, role: string | null) => {
    setAuthState({
      bootstrapped: true,
      isAuthenticated: true,
      token,
      userId,
      email,
      role,
    });
    storeUserId(userId);
    storeEmail(email);
    storeRole(role);
    storeToken(token);
  }, []);

  const restoreSession = useCallback(async () => {
    const session = await refreshSession();
    setAuthState({
      bootstrapped: true,
      isAuthenticated: true,
      token: session.token,
      userId: session.userId || null,
      email: session.email || null,
      role: session.role || null,
    });
    storeUserId(session.userId);
    storeEmail(session.email);
    storeRole(session.role || null);
    storeToken(session.token);
  }, []);

  const logout = useCallback(() => {
    setAuthState({
      bootstrapped: true,
      isAuthenticated: false,
      token: null,
      userId: null,
      email: null,
      role: null,
    });
    clearAuthStorage();
  }, []);

  useEffect(() => {
    if (authState.bootstrapped) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const session = await refreshSession();
        if (cancelled) {
          return;
        }
        setAuthState({
          bootstrapped: true,
          isAuthenticated: true,
          token: session.token,
          userId: session.userId || null,
          email: session.email || null,
          role: session.role || null,
        });
        storeUserId(session.userId);
        storeEmail(session.email);
        storeRole(session.role || null);
        storeToken(session.token);
      } catch {
        if (cancelled) {
          return;
        }
        clearAuthStorage();
        setAuthState({
          bootstrapped: true,
          isAuthenticated: false,
          token: null,
          userId: null,
          email: null,
          role: null,
        });
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [authState.bootstrapped]);

  useEffect(() => {
    return subscribeToAuthStorageChanges(() => {
      const storedAuth = getStoredAuth();
      setAuthState({
        bootstrapped: true,
        isAuthenticated: !!storedAuth.token,
        token: storedAuth.token,
        userId: storedAuth.userId,
        email: storedAuth.email,
        role: storedAuth.role,
      });
    });
  }, []);

  const value: AuthContextType = {
    ...authState,
    login,
    restoreSession,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
