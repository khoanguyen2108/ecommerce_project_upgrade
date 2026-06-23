"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  getPayosCancelStatus,
  getPayosReturnStatus,
} from "@/features/payments/api";
import type {
  PayosDisplayStatusResponse,
  PayosStatusQuery,
} from "@/features/payments/types";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/orders/OrdersPage";
import {
  formatCurrency,
  formatDateTime,
  formatOrderCode,
} from "@/components/orders/order-format";
import { ApiClientError } from "@/lib/errors/api-error";
import { PayosPaymentButton } from "@/components/payments/PayosPaymentButton";
import { PaymentThankYou } from "@/components/payments/PaymentThankYou";

type PaymentStatusSource = "return" | "cancel";
type PaymentStatusViewKind =
  | "non-paid"
  | "paid"
  | "pending"
  | "review"
  | "timed-out";

interface PaymentStatusPageProps {
  initialQuery: PayosStatusQuery;
  source: PaymentStatusSource;
}

interface PaymentStatusView {
  kind: PaymentStatusViewKind;
  message: string;
  note: string;
  title: string;
}

const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Your session is required. Sign in again to read payment status.",
  BAD_REQUEST: "The payment status lookup parameters are invalid.",
  FORBIDDEN: "This payment record is not available to this account.",
  NETWORK_ERROR:
    "The payment status API could not be reached. Check the backend and retry.",
  ORDER_NOT_FOUND: "The backend could not find an order for this status lookup.",
  PAYMENT_NOT_FOUND: "The backend could not find a payment for this status lookup.",
  PAYOS_STATUS_QUERY_REQUIRED:
    "An order ID or payOS order code is required to read payment status.",
  VALIDATION_ERROR: "The payment status lookup parameters are invalid.",
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60000;

export function PaymentStatusPage({
  initialQuery,
  source,
}: PaymentStatusPageProps) {
  const [status, setStatus] = useState<PayosDisplayStatusResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasPollingTimedOut, setHasPollingTimedOut] = useState(false);
  const pollStartedAtRef = useRef<number | null>(null);
  const hasLookup = Boolean(initialQuery.orderId || initialQuery.orderCode);
  const lookupKey = `${initialQuery.orderId ?? ""}:${initialQuery.orderCode ?? ""}`;
  const pageCopy = getPageCopy(source);

  useEffect(() => {
    pollStartedAtRef.current = null;
    setHasPollingTimedOut(false);
    setRefreshKey(0);
  }, [lookupKey, source]);

  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadStatus() {
      if (!hasLookup) {
        setStatus(undefined);
        setError(undefined);
        setRequestId(undefined);
        return;
      }

      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response =
          source === "return"
            ? await getPayosReturnStatus(initialQuery)
            : await getPayosCancelStatus(initialQuery);

        if (!isMounted) {
          return;
        }

        setStatus(response);

        if (shouldPollReturnStatus(source, response)) {
          if (pollStartedAtRef.current === null) {
            pollStartedAtRef.current = Date.now();
          }

          const elapsedMs = Date.now() - pollStartedAtRef.current;

          if (elapsedMs < POLL_TIMEOUT_MS) {
            setHasPollingTimedOut(false);
            pollTimer = setTimeout(
              () => setRefreshKey((current) => current + 1),
              POLL_INTERVAL_MS,
            );
          } else {
            setHasPollingTimedOut(true);
          }
        } else {
          pollStartedAtRef.current = null;
          setHasPollingTimedOut(false);
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setStatus(undefined);
        setError(getPaymentErrorMessage(loadError));
        setRequestId(getPaymentRequestId(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [hasLookup, initialQuery, refreshKey, source]);

  if (!hasLookup) {
    return (
      <main className="customer-page payment-page">
        <section className="payment-status-panel" aria-labelledby="payment-heading">
          <Info aria-hidden="true" className="payment-status-panel__icon" size={34} />
          <p className="eyebrow">{pageCopy.eyebrow}</p>
          <h1 id="payment-heading">Payment status unavailable</h1>
          <p>Belikeme needs an order ID or payOS order code to read status.</p>
          <PaymentActions primaryLabel="View orders" />
        </section>
      </main>
    );
  }

  if (isLoading && !status) {
    return (
      <main className="customer-page payment-page">
        <section className="payment-status-panel" aria-labelledby="payment-heading">
          <Loader2
            aria-hidden="true"
            className="payment-status-panel__icon spin"
            size={34}
          />
          <p className="eyebrow">{pageCopy.eyebrow}</p>
          <h1 id="payment-heading">{pageCopy.loadingTitle}</h1>
          <p>Reading Belikeme payment records.</p>
        </section>
      </main>
    );
  }

  if (error || !status) {
    return (
      <main className="customer-page payment-page">
        <section className="payment-status-panel" aria-labelledby="payment-heading">
          <AlertCircle
            aria-hidden="true"
            className="payment-status-panel__icon payment-status-panel__icon--error"
            size={34}
          />
          <p className="eyebrow">{pageCopy.eyebrow}</p>
          <h1 id="payment-heading">Payment status unavailable</h1>
          <p>{error || "Belikeme could not read that payment status right now."}</p>
          {requestId ? <small>Request {requestId}</small> : null}
          <PaymentActions primaryLabel="View orders" />
        </section>
      </main>
    );
  }

  if (isPaidStatus(status)) {
    return <PaymentThankYou status={status} />;
  }

  const view = getPaymentStatusView(status, source, hasPollingTimedOut);
  const NoteIcon = getPaymentStatusNoteIcon(view.kind);

  return (
    <main className="customer-page payment-page">
      <section
        className={`customer-hero customer-hero--compact payment-result payment-result--${view.kind}`}
        aria-labelledby="payment-heading"
      >
        <div>
          <p className="eyebrow">{pageCopy.eyebrow}</p>
          <div className="payment-status-heading">
            <h1 id="payment-heading">{view.title}</h1>
            <PaymentStatusBadge status={status.payment.status} />
          </div>
          <p>{view.message}</p>
          {isPaidStatus(status) && status.paidAt ? (
            <p className="payment-paid-at">Paid {formatDateTime(status.paidAt)}</p>
          ) : null}
        </div>
      </section>

      <section className="payment-status-grid" aria-label="Backend payment status">
        <article className="payment-status-card">
          <p className="eyebrow">Order</p>
          <OrderStatusBadge status={status.order.status} />
          <dl className="order-summary-list">
            <div>
              <dt>Order ID</dt>
              <dd>{status.order.id}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCurrency(status.order.totalAmount, status.order.currency)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(status.order.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(status.order.updatedAt)}</dd>
            </div>
            <div>
              <dt>Paid at</dt>
              <dd>{formatDateTime(status.order.paidAt)}</dd>
            </div>
            <div>
              <dt>Cancelled at</dt>
              <dd>{formatDateTime(status.order.cancelledAt)}</dd>
            </div>
            <div>
              <dt>Expires at</dt>
              <dd>{formatDateTime(status.order.expiresAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="payment-status-card">
          <p className="eyebrow">Payment</p>
          <PaymentStatusBadge status={status.payment.status} />
          <dl className="order-summary-list">
            <div>
              <dt>Provider</dt>
              <dd>{status.payment.provider}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>
                {formatCurrency(status.payment.amount, status.payment.currency)}
              </dd>
            </div>
            <div>
              <dt>payOS order code</dt>
              <dd>{formatOrderCode(status.payment.providerOrderCode)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(status.payment.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(status.payment.updatedAt)}</dd>
            </div>
            <div>
              <dt>Paid at</dt>
              <dd>{formatDateTime(status.payment.paidAt)}</dd>
            </div>
            <div>
              <dt>Cancelled at</dt>
              <dd>{formatDateTime(status.payment.cancelledAt)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <div
        className={`payment-read-note payment-read-note--${view.kind}`}
        role="status"
      >
        <NoteIcon
          aria-hidden="true"
          className={view.kind === "pending" ? "spin" : undefined}
          size={19}
        />
        <span>{view.note}</span>
      </div>

      <PaymentActions
        canRetry={source === "cancel" && status.retryEligible}
        isRefreshing={isLoading}
        onRefresh={() => setRefreshKey((current) => current + 1)}
        orderId={status.order.id}
      />
    </main>
  );
}

function PaymentActions({
  canRetry = false,
  isRefreshing = false,
  onRefresh,
  orderId,
  primaryLabel,
}: {
  canRetry?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  orderId?: string;
  primaryLabel?: string;
} = {}) {
  const orderHref = orderId
    ? `/orders/${encodeURIComponent(orderId)}`
    : "/orders";

  return (
    <div className="customer-actions">
      {canRetry && orderId ? (
        <PayosPaymentButton label="Retry with payOS" orderId={orderId} />
      ) : null}
      {onRefresh ? (
        <button
          className="button button--secondary"
          disabled={isRefreshing}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={isRefreshing ? "spin" : undefined}
            size={17}
          />
          Refresh status
        </button>
      ) : null}
      <Link className="button button--primary" href={orderHref}>
        {primaryLabel || (orderId ? "View order" : "View orders")}
      </Link>
      <Link className="button button--secondary" href="/products">
        Back to products
      </Link>
    </div>
  );
}

function shouldPollReturnStatus(
  source: PaymentStatusSource,
  status: PayosDisplayStatusResponse,
): boolean {
  return (
    source === "return" &&
    !status.reconciliationRequired &&
    status.order.status === "PENDING_PAYMENT" &&
    status.payment.status === "PENDING"
  );
}

function getPaymentStatusView(
  status: PayosDisplayStatusResponse,
  source: PaymentStatusSource,
  hasPollingTimedOut: boolean,
): PaymentStatusView {
  if (isPaidStatus(status)) {
    return {
      kind: "paid",
      title: "Payment confirmed",
      message:
        "Your payment has been verified. Your order is now being processed.",
      note: "Order PAID and Payment PAID.",
    };
  }

  if (status.reconciliationRequired) {
    return {
      kind: "review",
      title: "Payment under review",
      message:
        "We received payment information that requires manual review. Please contact support.",
      note: "Manual review is required before this payment can be treated as paid.",
    };
  }

  if (isPendingStatus(status)) {
    if (source === "return" && hasPollingTimedOut) {
      return {
        kind: "timed-out",
        title: "Payment still verifying",
        message:
          "Payment is still being verified. Please refresh or check your order again later.",
        note: status.statusMessage,
      };
    }

    if (source === "cancel") {
      return {
        kind: "pending",
        title: "Payment not completed",
        message:
          "Payment has not been confirmed. You can retry while this order is still eligible.",
        note: status.statusMessage,
      };
    }

    return {
      kind: "pending",
      title: "Verifying payment",
      message:
        "We are waiting for payment confirmation from payOS. This may take a few moments.",
      note: status.statusMessage,
    };
  }

  return {
    kind: "non-paid",
    title: "Payment not confirmed",
    message:
      "This payment is not marked paid. Please review your order status or contact support.",
    note: status.statusMessage,
  };
}

function getPaymentStatusNoteIcon(kind: PaymentStatusViewKind) {
  if (kind === "paid") {
    return CheckCircle2;
  }

  if (kind === "pending") {
    return Loader2;
  }

  if (kind === "timed-out") {
    return Info;
  }

  return AlertCircle;
}

function isPaidStatus(status: PayosDisplayStatusResponse): boolean {
  return status.order.status === "PAID" && status.payment.status === "PAID";
}

function isPendingStatus(status: PayosDisplayStatusResponse): boolean {
  return (
    status.order.status === "PENDING_PAYMENT" &&
    status.payment.status === "PENDING"
  );
}

function getPaymentErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return (
      PAYMENT_ERROR_MESSAGES[error.code] ||
      error.message ||
      "Belikeme could not read that payment status right now."
    );
  }

  return "Belikeme could not read that payment status right now.";
}

function getPaymentRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}

function getPageCopy(source: PaymentStatusSource) {
  if (source === "cancel") {
    return {
      eyebrow: "Payment cancel",
      loadingTitle: "Checking cancellation status",
    };
  }

  return {
    eyebrow: "Payment return",
    loadingTitle: "Checking return status",
  };
}
