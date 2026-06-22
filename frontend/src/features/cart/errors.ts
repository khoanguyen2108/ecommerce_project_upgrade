import { ApiClientError } from "@/lib/errors/api-error";

export const CART_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Sign in again to use your cart.",
  CART_CATEGORY_INACTIVE:
    "This product category is not available for cart updates.",
  CART_ITEM_NOT_FOUND:
    "That cart item is no longer available. Refresh the cart and try again.",
  CART_ITEM_QUANTITY_INVALID: "Choose a quantity from 1 to 99.",
  CART_ITEM_STOCK_UNAVAILABLE:
    "That quantity is not available for the selected item.",
  CART_PRODUCT_INACTIVE: "This product is not available for cart updates.",
  CART_VARIANT_INACTIVE:
    "This size and color is no longer available for cart updates.",
  CART_VARIANT_NOT_FOUND: "That size and color could not be found.",
  FORBIDDEN: "This cart is not available to the current account.",
  NETWORK_ERROR: "The cart API could not be reached. Check the backend and retry.",
  VALIDATION_ERROR: "Review the cart details and try again.",
};

export function getCartErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return CART_ERROR_MESSAGES[error.code] || error.message || fallback;
  }

  return fallback;
}

export function getCartRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}
