"use client";

import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { OrderStatusBadge } from "@/components/orders/OrdersPage";
import {
  formatCurrency,
  formatDateTime,
} from "@/components/orders/order-format";
import {
  createCheckoutOrder,
  getCheckoutSummary,
} from "@/features/checkout/api";
import {
  getCheckoutErrorCode,
  getCheckoutErrorMessage,
  getCheckoutRequestId,
} from "@/features/checkout/errors";
import type { CheckoutSummary as CheckoutSummaryModel } from "@/features/checkout/types";
import type { Order } from "@/features/orders/types";

export function CheckoutPage() {
  const [summary, setSummary] = useState<CheckoutSummaryModel>();
  const [createdOrder, setCreatedOrder] = useState<Order>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setIsLoading(true);
      setError(undefined);
      setErrorCode(undefined);
      setRequestId(undefined);

      try {
        const response = await getCheckoutSummary();

        if (isMounted) {
          setSummary(response.summary);
        }
      } catch (loadError) {
        if (isMounted) {
          setSummary(undefined);
          setError(
            getCheckoutErrorMessage(
              loadError,
              "Checkout summary could not be loaded.",
            ),
          );
          setErrorCode(getCheckoutErrorCode(loadError));
          setRequestId(getCheckoutRequestId(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  async function handleCreateOrder() {
    setIsSubmitting(true);
    setError(undefined);
    setErrorCode(undefined);
    setRequestId(undefined);

    try {
      const response = await createCheckoutOrder();
      setCreatedOrder(response.order);
      setSummary(undefined);
    } catch (submitError) {
      setError(
        getCheckoutErrorMessage(
          submitError,
          "Pending order could not be created.",
        ),
      );
      setErrorCode(getCheckoutErrorCode(submitError));
      setRequestId(getCheckoutRequestId(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdOrder) {
    return <CheckoutSuccess order={createdOrder} />;
  }

  return (
    <main className="customer-page checkout-page">
      <section className="customer-hero" aria-labelledby="checkout-heading">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1 id="checkout-heading">Create pending order</h1>
          <p>Confirm the cart summary before creating an unpaid order.</p>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading || isSubmitting}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={isLoading ? "spin" : undefined}
            size={17}
          />
          Refresh
        </button>
      </section>

      {error ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>{error}</span>
          {requestId ? <small>Request {requestId}</small> : null}
        </div>
      ) : null}

      {isLoading ? <CheckoutSkeleton /> : null}

      {!isLoading && errorCode === "CHECKOUT_CART_EMPTY" ? (
        <section className="wishlist-empty" aria-labelledby="checkout-empty-heading">
          <Info aria-hidden="true" size={38} strokeWidth={1.6} />
          <h2 id="checkout-empty-heading">Cart is empty</h2>
          <p>Add an in-stock size and color before checkout.</p>
          <Link className="button button--primary" href="/products">
            Browse products
          </Link>
        </section>
      ) : null}

      {!isLoading && summary ? (
        <>
          <CheckoutSummary summary={summary} />
          <section className="checkout-submit-panel" aria-label="Create order">
            <div className="payment-read-note" role="status">
              <Info aria-hidden="true" size={19} />
              <span>
                This creates an order with PENDING_PAYMENT status. Payment is not
                started in this phase.
              </span>
            </div>
            <button
              className="button button--primary"
              disabled={isSubmitting || summary.items.length === 0}
              onClick={handleCreateOrder}
              type="button"
            >
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="spin" size={17} />
              ) : null}
              {isSubmitting ? "Creating order..." : "Create pending order"}
            </button>
          </section>
        </>
      ) : null}
    </main>
  );
}

function CheckoutSuccess({ order }: { order: Order }) {
  return (
    <main className="customer-page checkout-page">
      <section
        aria-labelledby="checkout-success-heading"
        className="payment-status-panel checkout-success-panel"
        role="status"
      >
        <CheckCircle2
          aria-hidden="true"
          className="payment-status-panel__icon"
          size={34}
        />
        <p className="eyebrow">Order created</p>
        <h1 id="checkout-success-heading">Pending payment order</h1>
        <p>
          Order {order.id} was created with status{" "}
          <strong>PENDING_PAYMENT</strong>.
        </p>
        <OrderStatusBadge status={order.status} />
        <dl className="order-summary-list">
          <div>
            <dt>Total</dt>
            <dd>{formatCurrency(order.totalAmount, order.currency)}</dd>
          </div>
          <div>
            <dt>Expires at</dt>
            <dd>{formatDateTime(order.expiresAt)}</dd>
          </div>
        </dl>
        <div className="payment-read-note" role="status">
          <Info aria-hidden="true" size={19} />
          <span>Payment was not started. No paid status was created.</span>
        </div>
        <div className="customer-actions">
          <Link
            className="button button--primary"
            href={`/orders/${encodeURIComponent(order.id)}`}
          >
            View order
          </Link>
          <Link className="button button--secondary" href="/products">
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}

function CheckoutSkeleton() {
  return (
    <section className="checkout-summary-grid" aria-busy="true" aria-live="polite">
      <div className="checkout-items">
        <div className="customer-section__header">
          <span className="customer-skeleton-line customer-skeleton-line--wide" />
          <span className="customer-skeleton-line" />
        </div>
        <div className="checkout-item-list">
          {Array.from({ length: 3 }, (_, index) => (
            <div aria-hidden="true" className="checkout-item" key={index}>
              <span className="checkout-item__image checkout-item__image--skeleton" />
              <span className="checkout-item__body">
                <span className="customer-skeleton-line" />
                <span className="customer-skeleton-line customer-skeleton-line--wide" />
                <span className="customer-skeleton-line" />
              </span>
            </div>
          ))}
        </div>
      </div>
      <aside className="cart-summary-panel">
        <span className="customer-skeleton-line" />
        <span className="customer-skeleton-line customer-skeleton-line--wide" />
      </aside>
    </section>
  );
}
