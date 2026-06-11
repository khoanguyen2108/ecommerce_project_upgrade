import { API_BASE_URL } from "@/config/env";
import { apiRequest } from "@/lib/api/client";
import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from "@/features/auth/types";

export function loginWithEmail(payload: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    body: {
      email: payload.email,
      password: payload.password,
    },
    method: "POST",
  });
}

export function registerCustomer(
  payload: RegisterRequest,
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/auth/register", {
    body: {
      email: payload.email,
      password: payload.password,
      ...(payload.name ? { name: payload.name } : {}),
    },
    method: "POST",
  });
}

export function getCurrentUser(): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>("/auth/me", {
    auth: true,
    method: "GET",
  });
}

export function getGoogleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google`;
}
