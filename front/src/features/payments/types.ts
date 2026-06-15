import type {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentSummary,
} from "@/features/orders/types";

export interface CreatePayosPaymentRequest {
  orderId: string;
}

export interface Payment extends PaymentSummary {
  provider: PaymentProvider;
  status: PaymentStatus;
  providerTransactionReference: string | null;
  failureReason: string | null;
}

export interface PayosPaymentResponse {
  checkoutUrl: string | null;
  payment: Payment;
}

export interface PayosStatusQuery {
  orderId?: string;
  orderCode?: number;
}

export interface PayosDisplayOrder {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
}

export interface PayosDisplayStatusResponse {
  source: "return" | "cancel";
  displayOnly: true;
  message: string;
  order: PayosDisplayOrder;
  payment: Payment;
}
