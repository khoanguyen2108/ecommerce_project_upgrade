import { ApiClientError } from "@/lib/errors/api-error";

export const ADMIN_ORDER_ERROR_MESSAGES: Record<string, string> = {
  ADMIN_ORDER_ALREADY_CANCELLED: "This order has already been cancelled.",
  ADMIN_ORDER_ALREADY_EXPIRED: "This order has already expired.",
  ADMIN_ORDER_ALREADY_PAID:
    "This order is already paid and cannot be cancelled or expired.",
  ADMIN_ORDER_CANCELLED_FULFILLMENT_LOCKED:
    "Cancelled orders cannot be updated for fulfillment.",
  ADMIN_ORDER_EXPIRED_FULFILLMENT_LOCKED:
    "Expired orders cannot be updated for fulfillment.",
  ADMIN_ORDER_FULFILLMENT_REQUIRES_PAID_ORDER:
    "Fulfillment status can be updated after payment is confirmed.",
  ADMIN_ORDER_NOT_FOUND: "That order no longer exists.",
  ADMIN_ORDER_QUERY_INVALID: "The order filters are invalid. Review them and retry.",
  ADMIN_ORDER_STATUS_INVALID: "This order's current status does not allow that action.",
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  FORBIDDEN: "This account is not allowed to access admin orders.",
  NETWORK_ERROR: "The admin orders API could not be reached. Check the backend and retry.",
  VALIDATION_ERROR: "The order request is invalid. Review it and retry.",
};

export function getAdminOrderErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof ApiClientError
    ? ADMIN_ORDER_ERROR_MESSAGES[error.code] || error.message || fallback
    : fallback;
}

export function getAdminOrderRequestId(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.requestId : undefined;
}
