import type { Pagination } from "@/lib/api/types";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CANCELLED"
  | "EXPIRED";
export type OrderFulfillmentStatus =
  | "PENDING"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RETURNED";
export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";
export type PaymentProvider = "PAYOS";

export interface CreateOrderItemRequest {
  variantId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
}

export interface OrderQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

export interface OrderItem {
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

export interface PaymentSummary {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerOrderCode: number;
  checkoutUrl: string | null;
  providerPaymentLinkId: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
}

export interface Order {
  id: string;
  orderCode: string;
  userId: string;
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
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  items: OrderItem[];
  payments: PaymentSummary[];
}

export interface OrderResponse {
  order: Order;
}

export interface OrderListResponse {
  orders: Order[];
  pagination: Pagination;
}
