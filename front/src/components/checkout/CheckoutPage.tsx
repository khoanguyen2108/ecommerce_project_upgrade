"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { formatCurrency } from "@/components/orders/order-format";
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
  const { refreshCart } = useCart();
  const [summary, setSummary] = useState<CheckoutSummaryModel>();
  const [createdOrder, setCreatedOrder] = useState<Order>();
  const [voucherInput, setVoucherInput] = useState("");
  const [requestedVoucherCode, setRequestedVoucherCode] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const submissionLockRef = useRef(false);
  const voucherRequestLockRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setIsLoading(true);
      setError(undefined);
      setErrorCode(undefined);
      setRequestId(undefined);

      try {
        const response = await getCheckoutSummary(requestedVoucherCode);

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
          voucherRequestLockRef.current = false;
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, requestedVoucherCode]);

  function handleApplyVoucher(code = voucherInput) {
    if (voucherRequestLockRef.current) {
      return;
    }

    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setError("Enter a voucher code before applying it.");
      setErrorCode("CHECKOUT_VOUCHER_CODE_REQUIRED");
      return;
    }

    voucherRequestLockRef.current = true;
    setVoucherInput(normalizedCode);
    if (normalizedCode === requestedVoucherCode) {
      setRefreshKey((current) => current + 1);
    } else {
      setRequestedVoucherCode(normalizedCode);
    }
  }

  function handleRemoveVoucher() {
    if (voucherRequestLockRef.current) {
      return;
    }

    voucherRequestLockRef.current = true;
    setVoucherInput("");
    setRequestedVoucherCode(undefined);
  }

  async function handleCreateOrder() {
    if (submissionLockRef.current || voucherRequestLockRef.current) {
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setError(undefined);
    setErrorCode(undefined);
    setRequestId(undefined);

    try {
      const response = await createCheckoutOrder(requestedVoucherCode);
      setCreatedOrder(response.order);
      setSummary(undefined);
      void refreshCart().catch(() => undefined);
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
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (createdOrder) {
    return <CheckoutSuccess order={createdOrder} />;
  }

  const isEmpty = !isLoading && errorCode === "CHECKOUT_CART_EMPTY";

  return (
    <main className="customer-page checkout-page">
      <CheckoutIntro
        subtitle="Review your cart before creating an order that waits for payment confirmation."
        title="Review your order"
      />
      <CheckoutStepper current="review" />

      {error && !isEmpty ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>{error}</span>
          {requestId ? <small>Request {requestId}</small> : null}
          <button
            className="button button--secondary checkout-retry-button"
            disabled={isLoading || isSubmitting}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && !summary ? <CheckoutSkeleton /> : null}

      {isEmpty ? (
        <section className="checkout-empty" aria-labelledby="checkout-empty-heading">
          <Info aria-hidden="true" size={34} strokeWidth={1.6} />
          <p className="eyebrow">Checkout</p>
          <h2 id="checkout-empty-heading">Your cart is empty</h2>
          <p>Add an in-stock size and color before returning to checkout.</p>
          <Link className="button button--primary" href="/products">
            Back to products
          </Link>
        </section>
      ) : null}

      {summary ? (
        <CheckoutSummary
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          onApplyVoucher={handleApplyVoucher}
          onCreateOrder={handleCreateOrder}
          onRemoveVoucher={handleRemoveVoucher}
          summary={summary}
          voucherInput={voucherInput}
          onVoucherInputChange={setVoucherInput}
        />
      ) : null}
    </main>
  );
}

function CheckoutIntro({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <section className="checkout-intro" aria-labelledby="checkout-heading">
      <p className="eyebrow">Checkout</p>
      <h1 id="checkout-heading">{title}</h1>
      <p>{subtitle}</p>
    </section>
  );
}

function CheckoutStepper({ current }: { current: "review" | "pending" }) {
  const steps = [
    { id: "cart", label: "Cart" },
    { id: "review", label: "Review" },
    { id: "pending", label: "Pending payment" },
  ] as const;
  const currentIndex = current === "review" ? 1 : 2;

  return (
    <nav className="checkout-stepper" aria-label="Checkout progress">
      <ol>
        {steps.map((step, index) => {
          const isCurrent = step.id === current;
          const isComplete = index < currentIndex;

          return (
            <li
              aria-current={isCurrent ? "step" : undefined}
              className={`${isCurrent ? "is-current" : ""} ${isComplete ? "is-complete" : ""}`}
              key={step.id}
            >
              <span aria-hidden="true">{index + 1}</span>
              <strong>{step.label}</strong>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CheckoutSuccess({ order }: { order: Order }) {
  return (
    <main className="customer-page checkout-page checkout-page--success">
      <CheckoutIntro
        subtitle="Your order is saved and is now waiting for payment confirmation."
        title="Order created"
      />
      <CheckoutStepper current="pending" />

      <section
        aria-labelledby="checkout-success-heading"
        className="checkout-success-panel"
        role="status"
      >
        <div className="checkout-success-panel__mark">
          <CheckCircle2 aria-hidden="true" size={28} strokeWidth={1.7} />
        </div>
        <div className="checkout-success-panel__heading">
          <p className="eyebrow">Order status</p>
          <h2 id="checkout-success-heading">{order.status}</h2>
        </div>

        <dl className="checkout-success-details">
          <div>
            <dt>Order ID</dt>
            <dd>{order.id}</dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(order.subtotalAmount, order.currency)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>{formatCurrency(order.discountAmount, order.currency)}</dd>
          </div>
          {order.voucherCodeSnapshot ? (
            <div>
              <dt>Voucher</dt>
              <dd>{order.voucherCodeSnapshot}</dd>
            </div>
          ) : null}
          <div>
            <dt>Final total</dt>
            <dd>{formatCurrency(order.totalAmount, order.currency)}</dd>
          </div>
        </dl>

        <div className="checkout-pending-note" role="note">
          <Info aria-hidden="true" size={18} />
          <span>
            Payment has not been completed yet. Your order is waiting for payment
            confirmation.
          </span>
        </div>

        <div className="checkout-success-actions">
          <Link
            className="button button--primary"
            href={`/orders/${encodeURIComponent(order.id)}`}
          >
            View order
          </Link>
          <Link className="button button--secondary" href="/products">
            Continue shopping
          </Link>
          <Link className="button button--secondary" href="/orders">
            View orders
          </Link>
        </div>
      </section>
    </main>
  );
}

function CheckoutSkeleton() {
  return (
    <section className="checkout-layout" aria-busy="true" aria-live="polite">
      <div className="checkout-items">
        <div className="checkout-section-heading">
          <span className="customer-skeleton-line customer-skeleton-line--wide" />
          <span className="customer-skeleton-line" />
        </div>
        <div className="checkout-item-list">
          {Array.from({ length: 2 }, (_, index) => (
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
      <aside className="checkout-order-summary checkout-order-summary--skeleton">
        <span className="customer-skeleton-line" />
        <span className="customer-skeleton-line customer-skeleton-line--wide" />
        <span className="customer-skeleton-line" />
      </aside>
    </section>
  );
}
