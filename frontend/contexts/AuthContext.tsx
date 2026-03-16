import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'; // Import the React, createContext, useCallback, useContext, useEffect, useMemo, useRef, and useState from react for the authentication context
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import the AsyncStorage from @react-native-async-storage/async-storage for the authentication context
import * as Crypto from 'expo-crypto'; // Import the Crypto from expo-crypto for the authentication context
import { API_BASE } from '@/constants/config'; // Import the API_BASE from @/constants/config for the authentication context
import type { User } from '@/lib/auth-types'; // Import the User type from @/lib/auth-types for the authentication context

const AUTH_TOKEN_KEY = '@emmasenvy/auth_token'; // Define the key for the authentication token
const DEVICE_ID_KEY = '@emmasenvy/device_id'; // Define the key for the device id

/** AuthState is the state for the authentication context. */
interface AuthState {
  user: User | null; // Define the user for the authentication context
  token: string | null; // Define the token for the authentication context
  isLoading: boolean; // Define the loading state for the authentication context
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean; // Define the authenticated state for the authentication context
  setSession: (user: User, token: string, options?: { persist?: boolean }) => Promise<void>;
  clearSession: () => Promise<void>; // Define the clear session function for the authentication context
  logout: () => Promise<void>; // Define the logout function for the authentication context
  getDeviceId: () => Promise<string>; // Define the get device id function for the authentication context
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>; // Define the fetch with auth function for the authentication context
}

//Define the auth context for the authentication context
const AuthContext = createContext<AuthContextValue | null>(null);

// AuthProvider is the provider for the authentication context.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, // Define the user for the authentication context
    token: null, // Define the token for the authentication context
    isLoading: true, // Define the loading state for the authentication context
  });
  const tokenRef = useRef<string | null>(null); // Define the token ref for the authentication context
  tokenRef.current = state.token; // Set the token ref for the authentication context

  // Define the get device id function for the authentication context
  const getDeviceId = useCallback(async (): Promise<string> => {
    // Try to get the device id from the async storage
    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY); // Get the device id from the async storage
      // If the device id is not found or is not a string, generate a new device id and set it in the async storage
      if (!id || typeof id !== 'string') {
        id = Crypto.randomUUID(); // Generate a new device id 
        await AsyncStorage.setItem(DEVICE_ID_KEY, id); // Set the device id in the async storage 
      }
      return id; // Return the device id
    } catch {
      return Crypto.randomUUID(); // Return a new device id
    }
  }, []);

  // Define the set session function for the authentication context
  const setSession = useCallback(async (user: User, token: string, options?: { persist?: boolean }) => {
    // Set the persist option for the authentication context
    const persist = options?.persist !== false;
    if (persist) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token); // Set the token in the async storage
    }
    setState({ user, token, isLoading: false }); // Set the state for the authentication context
  }, []);

  // Define the clear session function for the authentication context
  const clearSession = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY); // Remove the token from the async storage
    setState((s) => ({ ...s, user: null, token: null })); // Set the state for the authentication context
  }, []);

  // Define the logout function for the authentication context
  const logout = useCallback(async () => {
    // Get the token from the token ref
    const token = tokenRef.current;
    if (token) {
      // Try to logout the user
      try {
        // Try to fetch the logout endpoint
        const res = await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        // If the logout is not successful, ignore the error
        if (!res.ok) {
          // ignore
        }
      } catch {
        // ignore
      }
    }
    await clearSession(); // Clear the session
  }, [clearSession]);

  // Define the fetch with auth function for the authentication context
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = tokenRef.current; // Get the token from the token ref
      const headers = new Headers(options.headers); // Create new headers for the request
      if (token) {
        headers.set('Authorization', `Bearer ${token}`); // Set the authorization header for the request
      }
      return fetch(url, { ...options, headers }); // Fetch the request
    },
    []
  );

  // Restore Effect - Restore the session from the async storage when the component mounts
  useEffect(() => {
    // Set the cancelled flag to false to prevent the effect from running multiple times
    let cancelled = false;
    (async () => {
      // Try to get the stored token from the async storage
      try {
        const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        // If the stored token is not found or the cancelled flag is true, set the loading state to false and return
        if (!stored || cancelled) {
          setState((s) => ({ ...s, isLoading: false }));
          return; 
        }
        // Try to fetch the me endpoint to see if the user is authenticated
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${stored}`,
          },
        });
        // If the cancelled flag is true, return
        if (cancelled) return;
        // If the response is successful, set the user and token in the state
        if (res.ok) {
          const data = (await res.json()) as { user: User }; // Parse the response as a user
          // If the user is found, set the user and token in the state
          if (data.user) {
            setState({ user: data.user, token: stored, isLoading: false });
            return;
          }
        }
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY); // Remove the token from the async storage
        setState({ user: null, token: null, isLoading: false }); // Set the state for the authentication context
      } catch {
        // If the cancelled flag is not true, set the loading state to false
        if (!cancelled) {
          setState((s) => ({ ...s, isLoading: false }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Define the value for the authentication context 
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>; // Return the authentication context provider
}

// Define the use auth function for the authentication context
export function useAuth(): AuthContextValue {
  // Get the context from the authentication context
  const ctx = useContext(AuthContext);
  // If the context is not found, throw an error
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx; // Return the context
}
