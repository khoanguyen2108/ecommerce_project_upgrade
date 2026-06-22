import type {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";
import type {
  AdminOrderCustomer,
  AdminWebhookEventSummary,
  PaymentReconciliationIssue,
} from "@/features/admin-orders/types";

export type AdminPaymentSort = "createdAt" | "updatedAt" | "paidAt" | "amount";
export type AdminPaymentSortDirection = "asc" | "desc";

export interface AdminPaymentQuery {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  provider?: PaymentProvider;
  search?: string;
  orderId?: string;
  userId?: string;
  from?: string;
  to?: string;
  sort?: AdminPaymentSort;
  order?: AdminPaymentSortDirection;
}

export interface AdminPaymentOrderSummary {
  id: string;
  userId: string | null;
  status: OrderStatus;
  subtotalAmount: number;
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
}

export interface AdminPaymentSummary {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerOrderCode: number;
  providerPaymentLinkId: string | null;
  providerTransactionReference: string | null;
  failureReason: string | null;
  order: AdminPaymentOrderSummary;
  user: AdminOrderCustomer | null;
  reconciliationIssues: PaymentReconciliationIssue[];
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
}

export interface AdminPayment extends AdminPaymentSummary {
  orderId: string;
  checkoutUrl: string | null;
  webhookEvents: AdminWebhookEventSummary[];
}

export interface AdminPaymentsListResponse {
  payments: AdminPaymentSummary[];
  pagination: Pagination;
}

export interface AdminPaymentResponse {
  payment: AdminPayment;
}

export interface PayosReadiness {
  payosClientIdConfigured: boolean;
  payosApiKeyConfigured: boolean;
  payosChecksumKeyConfigured: boolean;
  returnUrlConfigured: boolean;
  cancelUrlConfigured: boolean;
  webhookUrlConfigured: boolean;
  webhookPathMatches: boolean;
  backendUrlConfigured: boolean;
  environmentReady: boolean;
  credentials: {
    clientId: PayosSecretState;
    apiKey: PayosSecretState;
    checksumKey: PayosSecretState;
  };
  urls: {
    return: PayosUrlState;
    cancel: PayosUrlState;
    webhook: PayosUrlState;
    backend: PayosUrlState;
  };
  webhookEndpointPath: string;
  warnings: string[];
}

export interface PayosSecretState {
  present: boolean;
  length: number;
}

export interface PayosUrlState {
  configured: boolean;
  valid: boolean;
  host: string | null;
  url: string | null;
}

export interface PayosReadinessResponse {
  readiness: PayosReadiness;
}
