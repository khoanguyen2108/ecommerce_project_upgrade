export type UserRole = "CUSTOMER" | "ADMIN";
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

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  tokenType: "Bearer";
  expiresIn: string | number;
}

export type LoginResponse = AuthResponse;
export type RegisterResponse = AuthResponse;

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
