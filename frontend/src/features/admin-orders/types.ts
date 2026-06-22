import type {
  OrderFulfillmentStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";

export type AdminOrderSort =
  | "createdAt"
  | "updatedAt"
  | "totalAmount"
  | "paidAt";
export type AdminOrderSortDirection = "asc" | "desc";

export interface AdminOrderQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  fulfillmentStatus?: OrderFulfillmentStatus;
  search?: string;
  userId?: string;
  from?: string;
  to?: string;
  sort?: AdminOrderSort;
  order?: AdminOrderSortDirection;
}

export interface AdminOrderCustomer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

export interface AdminOrderPayment {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerOrderCode: number;
  checkoutUrl: string | null;
  providerPaymentLinkId: string | null;
  providerTransactionReference: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
}

export interface AdminOrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productName: string;
  imageUrl: string | null;
  sku: string | null;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  createdAt: string;
}

export interface AdminWebhookEventSummary {
  id: string;
  provider: PaymentProvider;
  paymentId: string | null;
  orderId: string | null;
  receivedAt: string;
  processedAt: string | null;
  processingStatus: string;
}

export type PaymentReconciliationIssueType =
  | "LATE_PROVIDER_PAID"
  | "PAID_AFTER_LOCAL_CANCELLED"
  | "PAID_AFTER_LOCAL_EXPIRED"
  | "PAID_STOCK_SHORTAGE"
  | "PROVIDER_LOCAL_STATUS_MISMATCH";

export type PaymentReconciliationIssueStatus =
  | "OPEN"
  | "REVIEWING"
  | "RESOLVED"
  | "REFUND_REQUIRED"
  | "REFUNDED"
  | "FULFILLMENT_REQUIRED";

export interface PaymentReconciliationIssue {
  id: string;
  orderId: string;
  paymentId: string;
  type: PaymentReconciliationIssueType;
  status: PaymentReconciliationIssueStatus;
  provider: PaymentProvider;
  providerOrderCode: number;
  providerPaymentLinkId: string | null;
  providerTransactionReference: string | null;
  amount: number;
  currency: string;
  safeReason: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  adminNote: string | null;
}

export interface AdminOrderBase {
  id: string;
  userId: string | null;
  user: AdminOrderCustomer | null;
  guestEmail: string | null;
  customerType: "GUEST" | "REGISTERED";
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  voucherId: string | null;
  voucherCodeSnapshot: string | null;
  voucherNameSnapshot: string | null;
  currency: string;
  shippingRecipientName: string | null;
  shippingPhone: string | null;
  shippingProvince: string | null;
  shippingDistrict: string | null;
  shippingWard: string | null;
  shippingAddressLine: string | null;
  shippingNote: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
}

export interface AdminOrderSummary extends AdminOrderBase {
  latestPayment: AdminOrderPayment | null;
}

export interface AdminOrder extends AdminOrderBase {
  items: AdminOrderItem[];
  payments: AdminOrderPayment[];
  webhookEvents: AdminWebhookEventSummary[];
  paymentReconciliationIssues: PaymentReconciliationIssue[];
}

export interface AdminOrdersListResponse {
  orders: AdminOrderSummary[];
  pagination: Pagination;
}

export interface AdminOrderResponse {
  order: AdminOrder;
}
