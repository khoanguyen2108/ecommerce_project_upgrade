import { API_BASE_URL } from "@/config/env";
import { apiRequest } from "@/lib/api/client";
import { ApiClientError } from "@/lib/errors/api-error";
import type {
  AuthResponse,
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RequestPasswordResetOtpRequest,
  RequestPasswordResetOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  UpdateMeRequest,
  UpdateMeResponse,
  VerifyPasswordResetOtpRequest,
  VerifyPasswordResetOtpResponse,
} from "@/features/auth/types";

export function loginUser(payload: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    body: {
      email: payload.email,
      password: payload.password,
    },
    method: "POST",
  });
}

export function registerUser(payload: RegisterRequest): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/auth/register", {
    body: {
      email: payload.email,
      password: payload.password,
      ...(payload.name ? { name: payload.name } : {}),
    },
    method: "POST",
  });
}

export function getCurrentUser(
  options: Pick<RequestInit, "signal"> = {},
): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>("/auth/me", {
    auth: true,
    credentials: "include",
    method: "GET",
    signal: options.signal,
  });
}

export function updateMe(payload: UpdateMeRequest): Promise<UpdateMeResponse> {
  return apiRequest<UpdateMeResponse>("/auth/me", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "PATCH",
  });
}

export function logoutUser(): Promise<{ success: true }> {
  return apiRequest<{ success: true }>("/auth/logout", {
    auth: true,
    credentials: "include",
    method: "POST",
  });
}

export function refreshToken(refreshTokenValue?: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/refresh", {
    body: refreshTokenValue ? { refreshToken: refreshTokenValue } : {},
    credentials: "include",
    method: "POST",
  });
}

export function requestPasswordResetOtp(
  payload: RequestPasswordResetOtpRequest,
): Promise<RequestPasswordResetOtpResponse> {
  return apiRequest<RequestPasswordResetOtpResponse>(
    "/auth/forgot-password/request-otp",
    {
      body: {
        email: payload.email,
      },
      method: "POST",
    },
  );
}

export function verifyPasswordResetOtp(
  payload: VerifyPasswordResetOtpRequest,
): Promise<VerifyPasswordResetOtpResponse> {
  return apiRequest<VerifyPasswordResetOtpResponse>(
    "/auth/forgot-password/verify-otp",
    {
      body: {
        email: payload.email,
        otp: payload.otp,
      },
      method: "POST",
    },
  );
}

export function resetPassword(
  payload: ResetPasswordRequest,
): Promise<ResetPasswordResponse> {
  return apiRequest<ResetPasswordResponse>("/auth/forgot-password/reset", {
    body: {
      email: payload.email,
      newPassword: payload.newPassword,
      otp: payload.otp,
    },
    method: "POST",
  });
}

export function getGoogleLoginUrl(): string {
  if (!API_BASE_URL) {
    throw new ApiClientError(
      "Belikeme API is not configured. Set NEXT_PUBLIC_API_BASE_URL and try again.",
      "API_BASE_URL_MISSING",
    );
  }

  return `${API_BASE_URL}/auth/google`;
}

export function startGoogleLogin(): void {
  window.location.assign(getGoogleLoginUrl());
}

export const loginWithEmail = loginUser;
export const registerCustomer = registerUser;
