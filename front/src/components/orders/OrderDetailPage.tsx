"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CreditCard,
  MapPin,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import {
  FulfillmentStatusBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/orders/OrdersPage";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatOrderCode,
  formatOrderDisplayId,
  getFulfillmentStatusLabel,
  getLatestPayment,
  getOrderErrorMessage,
  getOrderRequestId,
} from "@/components/orders/order-format";
import { getOrder } from "@/features/orders/api";
import type {
  Order,
  OrderFulfillmentStatus,
  PaymentSummary,
} from "@/features/orders/types";

interface OrderDetailPageProps {
  orderId: string;
}
const FULFILLMENT_STEPS: Array<{
  label: string;
  status: OrderFulfillmentStatus;
}> = [
  { label: "Preparing", status: "PENDING" },
  { label: "Picked up", status: "PICKED_UP" },
  { label: "In transit", status: "IN_TRANSIT" },
  { label: "Out for delivery", status: "OUT_FOR_DELIVERY" },
  { label: "Delivered", status: "DELIVERED" },
];

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const [order, setOrder] = useState<Order>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response = await getOrder(orderId);

        if (isMounted) {
          setOrder(response.order);
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setOrder(undefined);
        setError(
          getOrderErrorMessage(
            loadError,
            "This order could not be loaded right now.",
          ),
        );
        setRequestId(getOrderRequestId(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, refreshKey]);

  if (isLoading && !order) {
    return <OrderDetailLoading />;
  }

  if (error || !order) {
    return <OrderDetailError error={error} requestId={requestId} />;
  }

  const latestPayment = getLatestPayment(order);

  return (
    <main className="customer-page order-detail-page">
      <Link className="order-detail-back" href="/orders">
        <ArrowLeft aria-hidden="true" size={17} />
        Back to orders
      </Link>

      <header className="order-detail-heading" aria-labelledby="order-heading">
        <div className="order-detail-heading__copy">
          <p className="eyebrow">Order detail</p>
          <h1 id="order-heading">
            Order {formatOrderDisplayId(order.id)}
          </h1>
          <p>Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="order-detail-heading__aside">
          <div className="order-detail-badges" aria-label="Order statuses">
            <OrderStatusBadge status={order.status} />
            <FulfillmentStatusBadge status={order.fulfillmentStatus} />
          </div>
          <button
            className="order-detail-refresh"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isLoading ? "spin" : undefined}
              size={16}
            />
            {isLoading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="order-detail-layout">
        <div className="order-detail-main">
          <FulfillmentProgress order={order} />
          <OrderItems order={order} />
        </div>

        <aside className="order-detail-sidebar" aria-label="Order information">
          <OrderTotals order={order} />
          <ShippingAddress order={order} />
          <PaymentDetails currency={order.currency} payment={latestPayment} />
        </aside>
      </div>
    </main>
  );
}

function FulfillmentProgress({ order }: { order: Order }) {
  const activeIndex = FULFILLMENT_STEPS.findIndex(
    (step) => step.status === order.fulfillmentStatus,
  );
  const isInactive = order.status === "CANCELLED" || order.status === "EXPIRED";

  return (
    <section className="order-detail-card" aria-labelledby="shipping-progress-heading">
      <div className="order-detail-card__heading">
        <div>
          <p className="eyebrow">Shipping progress</p>
          <h2 id="shipping-progress-heading">
            {isInactive
              ? "Fulfillment stopped"
              : getFulfillmentStatusLabel(order.fulfillmentStatus)}
          </h2>
        </div>
        <Truck aria-hidden="true" size={22} />
      </div>
      <p className="order-detail-card__intro">
        {isInactive
          ? "This timeline is retained for reference. The order is no longer active."
          : "Fulfillment updates are read-only and come directly from our shipping team."}
      </p>
      <ol className={`fulfillment-progress${isInactive ? " is-inactive" : ""}`}>
        {FULFILLMENT_STEPS.map((step, index) => {
          const isComplete = !isInactive && index < activeIndex;
          const isCurrent = !isInactive && index === activeIndex;

          return (
            <li
              className={
                isComplete ? "is-complete" : isCurrent ? "is-current" : ""
              }
              key={step.status}
            >
              <span className="fulfillment-progress__marker">
                {isComplete ? (
                  <Check aria-hidden="true" size={14} strokeWidth={2.5} />
                ) : isCurrent ? (
                  <Truck aria-hidden="true" size={14} />
                ) : (
                  <span aria-hidden="true" />
                )}
              </span>
              <span className="fulfillment-progress__label">{step.label}</span>
              <small>
                {isComplete
                  ? "Complete"
                  : isCurrent
                    ? step.status === "DELIVERED" && order.fulfilledAt
                      ? formatDate(order.fulfilledAt)
                      : "Current"
                    : "Pending"}
              </small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OrderItems({ order }: { order: Order }) {
  return (
    <section className="order-detail-card" aria-labelledby="order-items-heading">
      <div className="order-detail-card__heading">
        <div>
          <p className="eyebrow">Your pieces</p>
          <h2 id="order-items-heading">Items in this order</h2>
        </div>
        <span className="order-detail-count">
          {formatNumber(order.items.length)} {order.items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {order.items.length === 0 ? (
        <div className="order-detail-empty" role="status">
          <Package aria-hidden="true" size={24} />
          <strong>No items to show</strong>
          <span>No item snapshots were returned for this order.</span>
        </div>
      ) : (
        <div className="order-detail-items">
          {order.items.map((item) => (
            <article className="order-detail-item" key={item.id}>
              <OrderItemImage alt={item.productName} imageUrl={item.imageUrl} />
              <div className="order-detail-item__info">
                <h3>{item.productName}</h3>
                <p>
                  <span>{item.color || "Color not set"}</span>
                  <span>{item.size || "Size not set"}</span>
                </p>
                {item.sku ? <small>SKU {item.sku}</small> : null}
              </div>
              <div className="order-detail-item__quantity">
                <span>Quantity</span>
                <strong>{formatNumber(item.quantity)}</strong>
              </div>
              <div className="order-detail-item__price">
                <span>{formatCurrency(item.unitPrice, order.currency)} each</span>
                <strong>{formatCurrency(item.lineTotal, order.currency)}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function OrderTotals({ order }: { order: Order }) {
  return (
    <section className="order-detail-card order-detail-totals" aria-labelledby="totals-heading">
      <div className="order-detail-card__heading">
        <h2 id="totals-heading">Order summary</h2>
      </div>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCurrency(order.subtotalAmount, order.currency)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd className={order.discountAmount > 0 ? "is-discount" : undefined}>
            {order.discountAmount > 0 ? "-" : ""}
            {formatCurrency(order.discountAmount, order.currency)}
          </dd>
        </div>
        {order.voucherCodeSnapshot ? (
          <div className="order-detail-voucher">
            <dt>Voucher</dt>
            <dd>{order.voucherCodeSnapshot}</dd>
          </div>
        ) : null}
        <div className="order-detail-total">
          <dt>Total</dt>
          <dd>{formatCurrency(order.totalAmount, order.currency)}</dd>
        </div>
      </dl>
    </section>
  );
}

function ShippingAddress({ order }: { order: Order }) {
  const address = [
    order.shippingAddressLine,
    order.shippingWard,
    order.shippingDistrict,
    order.shippingProvince,
  ].filter(Boolean);

  return (
    <section className="order-detail-card" aria-labelledby="shipping-address-heading">
      <div className="order-detail-card__heading order-detail-card__heading--icon">
        <span>
          <MapPin aria-hidden="true" size={18} />
        </span>
        <h2 id="shipping-address-heading">Shipping address</h2>
      </div>
      {order.shippingRecipientName ? (
        <address className="order-detail-address">
          <strong>{order.shippingRecipientName}</strong>
          {address.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {order.shippingPhone ? <span>{order.shippingPhone}</span> : null}
          {order.shippingNote ? (
            <span className="order-detail-address__note">
              Note: {order.shippingNote}
            </span>
          ) : null}
        </address>
      ) : (
        <div className="order-detail-empty order-detail-empty--compact">
          Delivery information is unavailable for this historical order.
        </div>
      )}
    </section>
  );
}

function PaymentDetails({
  currency,
  payment,
}: {
  currency: string;
  payment?: PaymentSummary;
}) {
  return (
    <section className="order-detail-card" aria-labelledby="payment-details-heading">
      <div className="order-detail-card__heading order-detail-card__heading--icon">
        <span>
          <CreditCard aria-hidden="true" size={18} />
        </span>
        <h2 id="payment-details-heading">Payment</h2>
      </div>
      {!payment ? (
        <div className="order-detail-empty order-detail-empty--compact">
          No payment record is available yet.
        </div>
      ) : (
        <dl className="order-detail-payment-list">
          <div>
            <dt>Provider</dt>
            <dd>{payment.provider}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <PaymentStatusBadge status={payment.status} />
            </dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{formatCurrency(payment.amount, payment.currency || currency)}</dd>
          </div>
          <div>
            <dt>Order code</dt>
            <dd>{formatOrderCode(payment.providerOrderCode)}</dd>
          </div>
          {payment.paidAt ? (
            <div>
              <dt>Paid at</dt>
              <dd>{formatDateTime(payment.paidAt)}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function OrderDetailLoading() {
  return (
    <main className="customer-page order-detail-page" aria-busy="true">
      <div className="order-detail-loading-back" />
      <section className="order-detail-loading-shell" role="status">
        <span className="sr-only">Loading order details</span>
        <div className="order-detail-loading-title">
          <span />
          <span />
        </div>
        <div className="order-detail-loading-grid">
          <div>
            <span />
            <span />
          </div>
          <div>
            <span />
            <span />
          </div>
        </div>
      </section>
    </main>
  );
}

function OrderDetailError({
  error,
  requestId,
}: {
  error?: string;
  requestId?: string;
}) {
  return (
    <main className="customer-page order-detail-page">
      <Link className="order-detail-back" href="/orders">
        <ArrowLeft aria-hidden="true" size={17} />
        Back to orders
      </Link>
      <section className="order-detail-error" role="alert">
        <span className="order-detail-error__icon">
          <AlertCircle aria-hidden="true" size={28} />
        </span>
        <p className="eyebrow">Order detail</p>
        <h1>Order unavailable</h1>
        <p>{error || "This order was not found for the current account."}</p>
        {requestId ? <small>Request {requestId}</small> : null}
        <div className="order-detail-error__actions">
          <Link className="button button--primary" href="/orders">
            View my orders
          </Link>
          <Link className="button button--secondary" href="/products">
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
