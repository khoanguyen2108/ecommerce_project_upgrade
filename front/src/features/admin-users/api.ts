
import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  AdminUserQuery,
  AdminUserDeleteResponse,
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

export function activateAdminUser(id: string): Promise<AdminUserResponse> {
  return apiRequest<AdminUserResponse>(
    `/admin/users/${encodeURIComponent(id)}/activate`,
    { auth: true, credentials: "include", method: "PATCH" },
  );
}

export function deactivateAdminUser(id: string): Promise<AdminUserResponse> {
  return apiRequest<AdminUserResponse>(
    `/admin/users/${encodeURIComponent(id)}/deactivate`,
    { auth: true, credentials: "include", method: "PATCH" },
  );
}

export function deleteAdminUser(id: string): Promise<AdminUserDeleteResponse> {
  return apiRequest<AdminUserDeleteResponse>(
    `/admin/users/${encodeURIComponent(id)}`,
    { auth: true, credentials: "include", method: "DELETE" },
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
