import type {
  Order,
  OrderFulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  PaymentSummary,
} from "@/features/orders/types";
import type { Locale } from "@/features/i18n/locale";
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

const ORDER_ERROR_MESSAGES_VI: Record<string, string> = {
  AUTH_REQUIRED: "Bạn cần đăng nhập lại để xem đơn hàng.",
  BAD_REQUEST: "Một số bộ lọc đơn hàng không hợp lệ. Hãy kiểm tra và thử lại.",
  FORBIDDEN: "Tài khoản này không có quyền xem đơn hàng.",
  NETWORK_ERROR: "Không thể kết nối API đơn hàng. Hãy kiểm tra backend và thử lại.",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng này.",
  VALIDATION_ERROR: "Một số bộ lọc đơn hàng không hợp lệ. Hãy kiểm tra và thử lại.",
};

export function getOrderErrorMessage(
  error: unknown,
  fallback: string,
  locale: Locale = "en",
): string {
  if (error instanceof ApiClientError) {
    const messages = locale === "vi" ? ORDER_ERROR_MESSAGES_VI : ORDER_ERROR_MESSAGES;
    return messages[error.code] || (locale === "en" ? error.message : fallback) || fallback;
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
  locale?: Locale,
): string {
  const amount = Number(value);
  const currencyCode = currency || "VND";

  if (!Number.isFinite(amount)) {
    return locale === "vi" ? "Không khả dụng" : "Not available";
  }

  try {
    if (!locale) {
      return new Intl.NumberFormat("vi-VN", {
        currency: currencyCode,
        maximumFractionDigits: currencyCode === "VND" ? 0 : 2,
        style: "currency",
      }).format(amount);
    }

    const formattedAmount = new Intl.NumberFormat(
      locale === "vi" ? "vi-VN" : "en-US",
      {
        maximumFractionDigits: currencyCode === "VND" ? 0 : 2,
        minimumFractionDigits: currencyCode === "VND" ? 0 : 2,
      },
    ).format(amount);

    return `${formattedAmount}\u00a0${currencyCode}`;
  } catch {
    return `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(amount)}\u00a0${currencyCode}`;
  }
}

export function formatDateTime(
  value: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!value) {
    return locale === "vi" ? "Chưa thiết lập" : "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return locale === "vi" ? "Không khả dụng" : "Not available";
  }

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(
  value: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!value) {
    return locale === "vi" ? "Chưa thiết lập" : "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return locale === "vi" ? "Không khả dụng" : "Not available";
  }

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function formatNumber(value: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(value);
}

export function formatOrderDisplayId(
  value: string | null | undefined,
): string {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return "#ORDER";
  }

  const shortValue =
    normalizedValue.length > 8
      ? normalizedValue.slice(-8).toUpperCase()
      : normalizedValue.toUpperCase();

  return `#${shortValue}`;
}

export function formatOrderCode(
  value: number | null | undefined,
  locale: Locale = "en",
): string {
  return value === null || value === undefined
    ? locale === "vi" ? "Chưa thiết lập" : "Not set"
    : String(value);
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

export function getFulfillmentStatusClass(status: OrderFulfillmentStatus): string {
  return `fulfillment-status-badge--${status.toLowerCase().replaceAll("_", "-")}`;
}

export function getOrderStatusLabel(
  status: OrderStatus,
  locale: Locale = "en",
): string {
  if (locale === "vi") {
    const labels: Record<OrderStatus, string> = {
      CANCELLED: "Đã hủy",
      EXPIRED: "Đã hết hạn",
      PAID: "Đã thanh toán",
      PENDING_PAYMENT: "Chờ thanh toán",
    };

    return labels[status];
  }

  const labels: Record<OrderStatus, string> = {
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    PAID: "Paid",
    PENDING_PAYMENT: "Pending payment",
  };

  return labels[status];
}

export function getPaymentStatusLabel(
  status: PaymentStatus,
  locale: Locale = "en",
): string {
  if (locale === "vi") {
    const labels: Record<PaymentStatus, string> = {
      CANCELLED: "Đã hủy",
      EXPIRED: "Đã hết hạn",
      FAILED: "Thất bại",
      PAID: "Đã thanh toán",
      PENDING: "Đang chờ",
    };

    return labels[status];
  }

  const labels: Record<PaymentStatus, string> = {
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    FAILED: "Failed",
    PAID: "Paid",
    PENDING: "Pending",
  };

  return labels[status];
}

export function getFulfillmentStatusLabel(
  status: OrderFulfillmentStatus,
  locale: Locale = "en",
): string {
  if (locale === "vi") {
    const labels: Record<OrderFulfillmentStatus, string> = {
      DELIVERED: "Đã giao",
      IN_TRANSIT: "Đang vận chuyển",
      OUT_FOR_DELIVERY: "Đang giao hàng",
      PENDING: "Đang chuẩn bị",
      PICKED_UP: "Đã lấy hàng",
      RETURNED: "Đã trả hàng",
    };

    return labels[status];
  }

  const labels: Record<OrderFulfillmentStatus, string> = {
    DELIVERED: "Delivered",
    IN_TRANSIT: "In transit",
    OUT_FOR_DELIVERY: "Out for delivery",
    PENDING: "Preparing",
    PICKED_UP: "Picked up",
    RETURNED: "Returned",
  };

  return labels[status];
}
