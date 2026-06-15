import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  AdminUserQuery,
  AdminUserResponse,
  AdminUsersListResponse,
  UpdateAdminUserRequest,
  UpdateAdminUserRoleRequest,
  UpdateAdminUserStatusRequest,
} from "@/features/admin-users/types";

export function listAdminUsers(
  query: AdminUserQuery = {},
): Promise<AdminUsersListResponse> {
  return apiRequest<AdminUsersListResponse>(withQuery("/admin/users", query), {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function getAdminUser(id: string): Promise<AdminUserResponse> {
  return apiRequest<AdminUserResponse>(
    `/admin/users/${encodeURIComponent(id)}`,
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function updateAdminUser(
  id: string,
  payload: UpdateAdminUserRequest,
): Promise<AdminUserResponse> {
  return apiRequest<AdminUserResponse>(
    `/admin/users/${encodeURIComponent(id)}`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function updateAdminUserStatus(
  id: string,
  payload: UpdateAdminUserStatusRequest,
): Promise<AdminUserResponse> {
  return apiRequest<AdminUserResponse>(
    `/admin/users/${encodeURIComponent(id)}/status`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function updateAdminUserRole(
  id: string,
  payload: UpdateAdminUserRoleRequest,
): Promise<AdminUserResponse> {
  return apiRequest<AdminUserResponse>(
    `/admin/users/${encodeURIComponent(id)}/role`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}
