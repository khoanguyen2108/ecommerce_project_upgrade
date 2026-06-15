import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  CreateOrderRequest,
  OrderListResponse,
  OrderQuery,
  OrderResponse,
} from "@/features/orders/types";

export function createOrder(payload: CreateOrderRequest): Promise<OrderResponse> {
  return apiRequest<OrderResponse>("/orders", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });
}

export function listOrders(
  query: OrderQuery = {},
): Promise<OrderListResponse> {
  return apiRequest<OrderListResponse>(withQuery("/orders", query), {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function getOrder(id: string): Promise<OrderResponse> {
  return apiRequest<OrderResponse>(`/orders/${encodeURIComponent(id)}`, {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}
