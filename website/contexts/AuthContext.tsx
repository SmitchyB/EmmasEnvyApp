"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@emmasenvy/shared";
import { getApiBase } from "@/lib/api-init";
import {
  clearAuthToken,
  getAuthToken,
  getDeviceId as getStoredDeviceId,
  setAuthToken,
} from "@/lib/storage";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  setSession: (user: User, token: string, options?: { persist?: boolean }) => Promise<void>;
  clearSession: () => Promise<void>;
  logout: () => Promise<void>;
  getDeviceId: () => Promise<string>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
  });
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = state.token;

  const getDeviceId = useCallback(async (): Promise<string> => {
    return getStoredDeviceId();
  }, []);

  const setSession = useCallback(
    async (user: User, token: string, options?: { persist?: boolean }) => {
      const persist = options?.persist !== false;
      if (persist) setAuthToken(token);
      setState({ user, token, isLoading: false });
    },
    []
  );

  const clearSession = useCallback(async () => {
    clearAuthToken();
    setState((s) => ({ ...s, user: null, token: null }));
  }, []);

  const logout = useCallback(async () => {
    const token = tokenRef.current;
    if (token) {
      try {
        await fetch(`${getApiBase()}/api/auth/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // ignore
      }
    }
    await clearSession();
  }, [clearSession]);

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = tokenRef.current;
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = getAuthToken();
        if (!stored || cancelled) {
          setState((s) => ({ ...s, isLoading: false }));
          return;
        }
        const res = await fetch(`${getApiBase()}/api/auth/me`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${stored}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { user: User };
          if (data.user) {
            setState({ user: data.user, token: stored, isLoading: false });
            return;
          }
        }
        clearAuthToken();
        setState({ user: null, token: null, isLoading: false });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: !!(state.user && state.token),
      setSession,
      clearSession,
      logout,
      getDeviceId,
      fetchWithAuth,
    }),
    [state, setSession, clearSession, logout, getDeviceId, fetchWithAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
