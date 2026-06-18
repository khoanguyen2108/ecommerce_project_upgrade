import type {
  AdminOrderQuery,
  AdminOrderResponse,
  AdminOrdersListResponse,
} from "@/features/admin-orders/types";
import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";

export function listAdminOrders(
  query: AdminOrderQuery = {},
): Promise<AdminOrdersListResponse> {
  return apiRequest<AdminOrdersListResponse>(withQuery("/admin/orders", query), {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function getAdminOrder(id: string): Promise<AdminOrderResponse> {
  return apiRequest<AdminOrderResponse>(
    `/admin/orders/${encodeURIComponent(id)}`,
    { auth: true, credentials: "include", method: "GET" },
  );
}

export function cancelAdminOrder(id: string): Promise<AdminOrderResponse> {
  return apiRequest<AdminOrderResponse>(
    `/admin/orders/${encodeURIComponent(id)}/cancel`,
    { auth: true, credentials: "include", method: "PATCH" },
  );
}

export function expireAdminOrder(id: string): Promise<AdminOrderResponse> {
  return apiRequest<AdminOrderResponse>(
    `/admin/orders/${encodeURIComponent(id)}/expire`,
    { auth: true, credentials: "include", method: "PATCH" },
  );
}
