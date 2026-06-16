import type {
  Order,
  OrderStatus,
  PaymentStatus,
  PaymentSummary,
} from "@/features/orders/types";
import { ApiClientError } from "@/lib/errors/api-error";

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CANCELLED",
  "EXPIRED",
];

export const ORDER_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Your session is required. Sign in again to view orders.",
  BAD_REQUEST: "Some order filters are invalid. Review the page and try again.",
  FORBIDDEN: "This order is not available to this account.",
  NETWORK_ERROR: "The orders API could not be reached. Check the backend and retry.",
  ORDER_NOT_FOUND: "That order could not be found.",
  VALIDATION_ERROR: "Some order filters are invalid. Review the page and try again.",
};

export function getOrderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return ORDER_ERROR_MESSAGES[error.code] || error.message || fallback;
  }

  return fallback;
}

export function getOrderRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}

export function formatCurrency(
  value: number,
  currency: string | null | undefined = "VND",
): string {
  const amount = Number(value);
  const currencyCode = currency || "VND";

  if (!Number.isFinite(amount)) {
    return "Not available";
  }

  try {
    return new Intl.NumberFormat("vi-VN", {
      currency: currencyCode,
      maximumFractionDigits: currencyCode === "VND" ? 0 : 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("en-US").format(amount)} ${currencyCode}`;
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatOrderCode(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not set" : String(value);
}

export function getLatestPayment(order: Order): PaymentSummary | undefined {
  return [...order.payments].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt).getTime() -
      new Date(left.updatedAt || left.createdAt).getTime(),
  )[0];
}

export function getOrderStatusClass(status: OrderStatus): string {
  return `order-status-badge--${status.toLowerCase().replace("_", "-")}`;
}

export function getPaymentStatusClass(status: PaymentStatus): string {
  return `payment-status-badge--${status.toLowerCase()}`;
}
