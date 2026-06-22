export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN";
export type AuthProvider = "EMAIL" | "GOOGLE";

export interface User {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  role: UserRole;
  authProvider?: AuthProvider;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name?: string;
  email: string;
  password: string;
}

export interface RequestPasswordResetOtpRequest {
  email: string;
}

export interface VerifyPasswordResetOtpRequest {
  email: string;
  otp: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface PasswordResetActionResponse {
  success: true;
  message: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  tokenType: "Bearer";
  expiresIn: string | number;
}

export type LoginResponse = AuthResponse;
export type RegisterResponse = AuthResponse;
export type RequestPasswordResetOtpResponse = PasswordResetActionResponse;
export type VerifyPasswordResetOtpResponse = PasswordResetActionResponse;
export type ResetPasswordResponse = PasswordResetActionResponse;

export interface CurrentUserResponse {
  user: User;
}

export interface UpdateMeRequest {
  name?: string | null;
  phone?: string | null;
}

export interface UpdateMeResponse {
  user: User;
}
