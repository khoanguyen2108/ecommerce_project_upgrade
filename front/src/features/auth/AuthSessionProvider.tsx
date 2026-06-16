"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getCurrentUser, logoutUser } from "@/features/auth/api";
import {
  clearAuthSession,
  getStoredAccessToken,
  getStoredUser,
  persistAuthenticatedUser,
  persistEmailAuthSession,
} from "@/features/auth/session";
import type { AuthResponse, User } from "@/features/auth/types";

interface AuthSessionContextValue {
  accessToken?: string;
  currentUser?: User;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  setAuthenticatedSession: (response: AuthResponse) => void;
  setAuthenticatedUser: (user: User) => void;
}

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(
  undefined,
);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string>();
  const [currentUser, setCurrentUser] = useState<User>();
  const [isLoading, setIsLoading] = useState(true);

  const setAuthenticatedSession = useCallback((response: AuthResponse) => {
    persistEmailAuthSession(response);
    setAccessToken(response.accessToken);
    setCurrentUser(response.user);
  }, []);

  const setAuthenticatedUser = useCallback((user: User) => {
    persistAuthenticatedUser(user);
    setCurrentUser(user);
    setAccessToken(getStoredAccessToken());
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Local session cleanup is still safe if the server-side logout is unavailable.
    } finally {
      clearAuthSession();
      setAccessToken(undefined);
      setCurrentUser(undefined);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    setAccessToken(getStoredAccessToken());
    setCurrentUser(getStoredUser());

    async function hydrateSession() {
      try {
        const response = await getCurrentUser({ signal: controller.signal });

        if (!isMounted) {
          return;
        }

        persistAuthenticatedUser(response.user);
        setCurrentUser(response.user);
        setAccessToken(getStoredAccessToken());
      } catch {
        if (!isMounted) {
          return;
        }

        if (!getStoredAccessToken()) {
          setCurrentUser(undefined);
        }
      } finally {
        window.clearTimeout(timeoutId);

        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void hydrateSession();

    return () => {
      isMounted = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      accessToken,
      currentUser,
      isAuthenticated: Boolean(currentUser),
      isLoading,
      logout,
      setAuthenticatedSession,
      setAuthenticatedUser,
    }),
    [
      accessToken,
      currentUser,
      isLoading,
      logout,
      setAuthenticatedSession,
      setAuthenticatedUser,
    ],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }

  return context;
}
