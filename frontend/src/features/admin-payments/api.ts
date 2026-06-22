import type {
  AdminPaymentQuery,
  AdminPaymentResponse,
  AdminPaymentsListResponse,
  PayosReadinessResponse,
} from "@/features/admin-payments/types";
import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";

export function listAdminPayments(
  query: AdminPaymentQuery = {},
): Promise<AdminPaymentsListResponse> {
  return apiRequest<AdminPaymentsListResponse>(
    withQuery("/admin/payments", query),
    { auth: true, credentials: "include", method: "GET" },
  );
}

export function getAdminPayment(id: string): Promise<AdminPaymentResponse> {
  return apiRequest<AdminPaymentResponse>(
    `/admin/payments/${encodeURIComponent(id)}`,
    { auth: true, credentials: "include", method: "GET" },
  );
}

export function getPayosReadiness(): Promise<PayosReadinessResponse> {
  return apiRequest<PayosReadinessResponse>(
    "/admin/payments/payos/readiness",
    { auth: true, credentials: "include", method: "GET" },
  );
}
