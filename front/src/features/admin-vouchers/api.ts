import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  AdminVoucherQuery,
  AdminVoucherResponse,
  AdminVouchersListResponse,
  AdminVoucherWriteRequest,
  UpdateAdminVoucherRequest,
} from "@/features/admin-vouchers/types";

export function listAdminVouchers(
  query: AdminVoucherQuery = {},
): Promise<AdminVouchersListResponse> {
  return apiRequest<AdminVouchersListResponse>(
    withQuery("/admin/vouchers", query),
    { auth: true, credentials: "include", method: "GET" },
  );
}

export function getAdminVoucher(id: string): Promise<AdminVoucherResponse> {
  return apiRequest<AdminVoucherResponse>(
    `/admin/vouchers/${encodeURIComponent(id)}`,
    { auth: true, credentials: "include", method: "GET" },
  );
}

export function createAdminVoucher(
  payload: AdminVoucherWriteRequest,
): Promise<AdminVoucherResponse> {
  return apiRequest<AdminVoucherResponse>("/admin/vouchers", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });
}

export function updateAdminVoucher(
  id: string,
  payload: UpdateAdminVoucherRequest,
): Promise<AdminVoucherResponse> {
  return apiRequest<AdminVoucherResponse>(
    `/admin/vouchers/${encodeURIComponent(id)}`,
    { auth: true, body: payload, credentials: "include", method: "PATCH" },
  );
}

export function activateAdminVoucher(id: string): Promise<AdminVoucherResponse> {
  return updateVoucherStatus(id, "activate");
}

export function deactivateAdminVoucher(id: string): Promise<AdminVoucherResponse> {
  return updateVoucherStatus(id, "deactivate");
}

function updateVoucherStatus(
  id: string,
  action: "activate" | "deactivate",
): Promise<AdminVoucherResponse> {
  return apiRequest<AdminVoucherResponse>(
    `/admin/vouchers/${encodeURIComponent(id)}/${action}`,
    { auth: true, credentials: "include", method: "PATCH" },
  );
}
