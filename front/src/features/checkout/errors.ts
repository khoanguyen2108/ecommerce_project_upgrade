import { ApiClientError } from "@/lib/errors/api-error";

export const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Sign in again to continue checkout.",
  CHECKOUT_CART_EMPTY: "Your cart is empty. Add an item before checkout.",
  CHECKOUT_CATEGORY_INACTIVE:
    "One item belongs to a category that is no longer available.",
  CHECKOUT_ITEM_QUANTITY_INVALID: "One item has an invalid quantity.",
  CHECKOUT_ITEM_STOCK_UNAVAILABLE:
    "One item no longer has enough stock for checkout.",
  CHECKOUT_PRODUCT_INACTIVE: "One product is no longer available.",
  CHECKOUT_TOTAL_INVALID:
    "Checkout totals could not be confirmed. Review the cart and try again.",
  CHECKOUT_VARIANT_INACTIVE:
    "One size and color is no longer available for checkout.",
  CHECKOUT_VARIANT_NOT_FOUND: "One size and color could not be found.",
  FORBIDDEN: "Checkout is not available to the current account.",
  NETWORK_ERROR:
    "The checkout API could not be reached. Check the backend and retry.",
  VALIDATION_ERROR: "Review checkout details and try again.",
};

export function getCheckoutErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiClientError) {
    const message = CHECKOUT_ERROR_MESSAGES[error.code] || error.message || fallback;
    const invalidItems = getInvalidItemSummaries(error.details);

    return invalidItems.length > 0
      ? `${message} ${invalidItems.slice(0, 3).join(" ")}`
      : message;
  }

  return fallback;
}

export function getCheckoutErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.code;
  }

  return undefined;
}

export function getCheckoutRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}

function getInvalidItemSummaries(details: unknown): string[] {
  if (!details || typeof details !== "object") {
    return [];
  }

  const invalidItems = (details as { invalidItems?: unknown }).invalidItems;

  if (!Array.isArray(invalidItems)) {
    return [];
  }

  return invalidItems
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const record = item as {
        availableStock?: unknown;
        code?: unknown;
        productName?: unknown;
        quantity?: unknown;
        variantId?: unknown;
      };
      const label =
        typeof record.productName === "string" && record.productName.trim()
          ? record.productName.trim()
          : typeof record.variantId === "string"
            ? `Variant ${record.variantId}`
            : "An item";
      const code =
        typeof record.code === "string" && CHECKOUT_ERROR_MESSAGES[record.code]
          ? CHECKOUT_ERROR_MESSAGES[record.code]
          : "needs review.";
      const stock =
        typeof record.availableStock === "number"
          ? ` Available stock: ${record.availableStock}.`
          : "";

      return `${label}: ${code}${stock}`;
    })
    .filter((value): value is string => Boolean(value));
}
