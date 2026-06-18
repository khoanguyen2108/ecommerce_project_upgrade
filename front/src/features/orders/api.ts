import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  CreateOrderRequest,
  Order,
  OrderItem,
  OrderListResponse,
  OrderQuery,
  OrderResponse,
} from "@/features/orders/types";

interface OrderItemApiResponse extends Omit<OrderItem, "imageUrl"> {
  imageUrl?: unknown;
  productImageUrl?: unknown;
}

interface OrderApiResponse extends Omit<Order, "items"> {
  items: OrderItemApiResponse[];
}

interface OrderWireResponse {
  order: OrderApiResponse;
}

interface OrderListWireResponse extends Omit<OrderListResponse, "orders"> {
  orders: OrderApiResponse[];
}

export async function createOrder(
  payload: CreateOrderRequest,
): Promise<OrderResponse> {
  const response = await apiRequest<OrderWireResponse>("/orders", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });

  return { order: normalizeOrder(response.order) };
}

export async function listOrders(
  query: OrderQuery = {},
): Promise<OrderListResponse> {
  const response = await apiRequest<OrderListWireResponse>(
    withQuery("/orders", query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );

  return {
    ...response,
    orders: response.orders.map(normalizeOrder),
  };
}

export async function getOrder(id: string): Promise<OrderResponse> {
  const response = await apiRequest<OrderWireResponse>(
    `/orders/${encodeURIComponent(id)}`,
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );

  return { order: normalizeOrder(response.order) };
}

function normalizeOrder(order: OrderApiResponse): Order {
  return {
    ...order,
    items: order.items.map(normalizeOrderItem),
  };
}

function normalizeOrderItem(item: OrderItemApiResponse): OrderItem {
  const { productImageUrl, ...orderItem } = item;

  return {
    ...orderItem,
    imageUrl:
      normalizeImageUrl(item.imageUrl) ?? normalizeImageUrl(productImageUrl),
  };
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
}
