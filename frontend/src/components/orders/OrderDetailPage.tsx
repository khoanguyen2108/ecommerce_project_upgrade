"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getOrder } from "@/features/orders/api";
import type { Order, PaymentSummary } from "@/features/orders/types";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import { PayosPaymentButton } from "@/components/payments/PayosPaymentButton";
import {
  FulfillmentStatusBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/orders/OrdersPage";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatOrderCode,
  getOrderErrorMessage,
  getOrderRequestId,
} from "@/components/orders/order-format";

interface OrderDetailPageProps {
  orderId: string;
}

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

        if (!isMounted) {
          return;
        }

        setOrder(response.order);
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
    return (
      <main className="customer-page">
        <section className="customer-hero customer-hero--compact">
          <p className="eyebrow">Order detail</p>
          <h1>Loading order</h1>
          <p>Reading the backend order record.</p>
        </section>
        <div className="order-detail-loading" role="status">
          <span className="customer-skeleton-line customer-skeleton-line--wide" />
          <span className="customer-skeleton-line" />
          <span className="customer-skeleton-line customer-skeleton-line--wide" />
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="customer-page">
        <section className="customer-hero customer-hero--compact">
          <p className="eyebrow">Order detail</p>
          <h1>Order unavailable</h1>
        </section>
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>
            {error || "This order was not found for the current account."}
          </span>
          {requestId ? <small>Request {requestId}</small> : null}
        </div>
        <div className="customer-actions">
          <Link className="button button--primary" href="/orders">
            Back to orders
          </Link>
          <Link className="button button--secondary" href="/products">
            Back to products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <section className="customer-hero customer-hero--compact" aria-labelledby="order-heading">
        <div>
          <p className="eyebrow">Order detail</p>
          <h1 id="order-heading">Order {order.id}</h1>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading}
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

      <section className="order-detail-grid" aria-label="Order summary">
        <article className="order-summary-panel">
          <p className="eyebrow">Backend order status</p>
          <div className="order-status-stack">
            <OrderStatusBadge status={order.status} />
            <FulfillmentStatusBadge status={order.fulfillmentStatus} />
          </div>
          <dl className="order-summary-list">
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
                <dd>
                  {order.voucherCodeSnapshot}
                  {order.voucherNameSnapshot
                    ? ` — ${order.voucherNameSnapshot}`
                    : ""}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Final total</dt>
              <dd>{formatCurrency(order.totalAmount, order.currency)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(order.updatedAt)}</dd>
            </div>
            <div>
              <dt>Paid at</dt>
              <dd>{formatDateTime(order.paidAt)}</dd>
            </div>
            <div>
              <dt>Delivered at</dt>
              <dd>{formatDateTime(order.fulfilledAt)}</dd>
            </div>
            <div>
              <dt>Cancelled at</dt>
              <dd>{formatDateTime(order.cancelledAt)}</dd>
            </div>
            <div>
              <dt>Expires at</dt>
              <dd>{formatDateTime(order.expiresAt)}</dd>
            </div>
          </dl>
        </article>

        <PaymentSummaryPanel
          currency={order.currency}
          payments={order.payments}
        />
        <article className="order-summary-panel">
          <p className="eyebrow">Delivery information</p>
          {order.shippingRecipientName ? (
            <dl className="order-summary-list">
              <div><dt>Recipient</dt><dd>{order.shippingRecipientName}</dd></div>
              <div><dt>Phone</dt><dd>{order.shippingPhone || 'Not set'}</dd></div>
              <div><dt>Address</dt><dd>{formatShippingAddress(order)}</dd></div>
              {order.shippingNote ? <div><dt>Note</dt><dd>{order.shippingNote}</dd></div> : null}
            </dl>
          ) : <div className="order-summary-empty">Delivery information is unavailable for this historical order.</div>}
        </article>
      </section>

      <section className="customer-section" aria-labelledby="order-items-heading">
        <div className="customer-section__header">
          <div>
            <p className="eyebrow">Item snapshots</p>
            <h2 id="order-items-heading">Items</h2>
          </div>
          <span>{formatNumber(order.items.length)} items</span>
        </div>

        <div className="order-table-wrap">
          <table className="order-table order-table--items">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th>Unit price</th>
                <th>Quantity</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <tr>
                  <td className="order-table__state" colSpan={6}>
                    No item snapshots were returned for this order.
                  </td>
                </tr>
              ) : (
                order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="order-item-product">
                        <OrderItemImage
                          alt={item.productName}
                          imageUrl={item.imageUrl}
                        />
                        <strong>{item.productName}</strong>
                      </div>
                    </td>
                    <td>
                      {item.size} / {item.color}
                    </td>
                    <td>{item.sku || "Not set"}</td>
                    <td>{formatCurrency(item.unitPrice, order.currency)}</td>
                    <td>{formatNumber(item.quantity)}</td>
                    <td>{formatCurrency(item.lineTotal, order.currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="customer-actions">
        {order.status === "PENDING_PAYMENT" ? (
          <PayosPaymentButton label="Continue payment with payOS" orderId={order.id} />
        ) : null}
        <Link className="button button--primary" href="/orders">
          Back to orders
        </Link>
        <Link className="button button--secondary" href="/products">
          Back to products
        </Link>
      </div>
    </main>
  );
}

function formatShippingAddress(order: Order): string {
  return [order.shippingAddressLine, order.shippingWard, order.shippingDistrict, order.shippingProvince].filter(Boolean).join(', ') || 'Not set';
}

function PaymentSummaryPanel({
  currency,
  payments,
}: {
  currency: string;
  payments: PaymentSummary[];
}) {
  return (
    <article className="order-summary-panel">
      <p className="eyebrow">Payment summary</p>
      {payments.length === 0 ? (
        <div className="order-summary-empty" role="status">
          No payment summary was returned for this order.
        </div>
      ) : (
        <div className="payment-summary-list">
          {payments.map((payment) => (
            <section className="payment-summary-item" key={payment.id}>
              <div className="payment-summary-item__header">
                <strong>{payment.provider}</strong>
                <PaymentStatusBadge status={payment.status} />
              </div>
              <dl className="order-summary-list">
                <div>
                  <dt>Amount</dt>
                  <dd>{formatCurrency(payment.amount, payment.currency || currency)}</dd>
                </div>
                <div>
                  <dt>payOS order code</dt>
                  <dd>{formatOrderCode(payment.providerOrderCode)}</dd>
                </div>
                <div>
                  <dt>Checkout link</dt>
                  <dd>{payment.checkoutUrl ? "Recorded by backend" : "Not set"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(payment.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(payment.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Paid at</dt>
                  <dd>{formatDateTime(payment.paidAt)}</dd>
                </div>
                <div>
                  <dt>Cancelled at</dt>
                  <dd>{formatDateTime(payment.cancelledAt)}</dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

