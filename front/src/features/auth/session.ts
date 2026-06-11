import type { LoginResponse, User } from "@/features/auth/types";

const ACCESS_TOKEN_KEY = "belikeme.accessToken";
const USER_KEY = "belikeme.user";

export function persistEmailAuthSession(response: LoginResponse): void {
  if (!isBrowser()) {
    return;
  }

  if (response.accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  }

  window.localStorage.setItem(USER_KEY, JSON.stringify(response.user));
}

export function persistAuthenticatedUser(user: User): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredAccessToken(): string | undefined {
  if (!isBrowser()) {
    return undefined;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || undefined;
}

export function clearAuthSession(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}
