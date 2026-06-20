import { apiRequest } from "@/lib/api/client";
import type {
  AddCartItemRequest,
  CartResponse,
  UpdateCartItemRequest,
} from "@/features/cart/types";

export function getCart(): Promise<CartResponse> {
  return apiRequest<CartResponse>("/cart", {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function addCartItem(
  payload: AddCartItemRequest,
): Promise<CartResponse> {
  return apiRequest<CartResponse>("/cart/items", {
    auth: true,
    body: { quantity: payload.quantity, variantId: payload.variantId },
    credentials: "include",
    method: "POST",
  });
}

export function updateCartItem(
  id: string,
  payload: UpdateCartItemRequest,
): Promise<CartResponse> {
  return apiRequest<CartResponse>(`/cart/items/${encodeURIComponent(id)}`, {
    auth: true,
    body: payload,
    credentials: "include",
    method: "PATCH",
  });
}

export function removeCartItem(id: string): Promise<CartResponse> {
  return apiRequest<CartResponse>(`/cart/items/${encodeURIComponent(id)}`, {
    auth: true,
    credentials: "include",
    method: "DELETE",
  });
}

export function clearCart(): Promise<CartResponse> {
  return apiRequest<CartResponse>("/cart", {
    auth: true,
    credentials: "include",
    method: "DELETE",
  });
}
