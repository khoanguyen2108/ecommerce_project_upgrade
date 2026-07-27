
import type { AuthProvider, UserRole } from "@/features/auth/types";
import type { Pagination } from "@/lib/api/types";

export type AdminUserSort =
  | "createdAt"
  | "updatedAt"
  | "email"
  | "name"
  | "role"
  | "authProvider"
  | "isActive";
export type AdminUserOrder = "asc" | "desc";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  authProvider?: AuthProvider;
  sort?: AdminUserSort;
  order?: AdminUserOrder;
}

export interface UpdateAdminUserRequest {
  name?: string | null;
  phone?: string | null;
}

export interface UpdateAdminUserStatusRequest {
  isActive: boolean;
}

export interface UpdateAdminUserRoleRequest {
  role: UserRole;
}

export interface AdminUsersListResponse {
  users: AdminUser[];
  pagination: Pagination;
}

export interface AdminUserResponse {
  user: AdminUser;
}

export interface AdminUserDeleteResponse {
  deletedId: string;
}
