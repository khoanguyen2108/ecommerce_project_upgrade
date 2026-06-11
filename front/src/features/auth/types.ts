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

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  tokenType: "Bearer";
  expiresIn: string | number;
}

export type RegisterResponse = LoginResponse;

export interface CurrentUserResponse {
  user: User;
}
