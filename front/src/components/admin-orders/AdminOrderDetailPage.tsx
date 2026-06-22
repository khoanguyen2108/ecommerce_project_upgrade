"use client";

import { Check, Copy, Printer, RefreshCw, Truck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AdminFeedback,
  AdminOrderStatusBadge,
  AdminPaymentSafetyNote,
  AdminPaymentStatusBadge,
} from "@/components/admin/AdminCommerceUi";
import {
  cancelAdminOrder,
  expireAdminOrder,
  getAdminOrder,
  updateAdminOrderFulfillmentStatus,
} from "@/features/admin-orders/api";
import {
  getAdminOrderErrorMessage,
  getAdminOrderRequestId,
} from "@/features/admin-orders/errors";
import type { AdminOrder } from "@/features/admin-orders/types";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import {
  formatCurrency,
  formatDateTime,
  formatOrderCode,
  formatOrderDisplayId,
} from "@/components/orders/order-format";
import type { OrderFulfillmentStatus } from "@/features/orders/types";

const FULFILLMENT_STEPS: Array<{
  label: string;
  status: Exclude<OrderFulfillmentStatus, "PENDING">;
}> = [
  { label: "Picked Up", status: "PICKED_UP" },
  { label: "In Transit", status: "IN_TRANSIT" },
  { label: "Out for Delivery", status: "OUT_FOR_DELIVERY" },
  { label: "Delivered", status: "DELIVERED" },
];

const FULFILLMENT_LABELS: Record<OrderFulfillmentStatus, string> = {
  DELIVERED: "Delivered",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  PENDING: "Preparing",
  PICKED_UP: "Picked up",
};

export function AdminOrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrder>();
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    "cancel" | "expire" | "fulfillment"
  >();
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response = await getAdminOrder(orderId);
        if (active) setOrder(response.order);
      } catch (loadError) {
        if (active) {
          setOrder(undefined);
          setError(
            getAdminOrderErrorMessage(
              loadError,
              "This admin order could not be loaded.",
            ),
          );
          setRequestId(getAdminOrderRequestId(loadError));
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [orderId, refreshKey]);

  async function transition(action: "cancel" | "expire") {
    if (!order || order.status !== "PENDING_PAYMENT") return;

    const confirmed = window.confirm(
      `Confirm ${action} for order ${order.id}? This does not call payOS and cannot mark the order paid.`,
    );

    if (!confirmed) return;

    setBusyAction(action);
    setError(undefined);
    setRequestId(undefined);
    setSuccess(undefined);

    try {
      const response =
        action === "cancel"
          ? await cancelAdminOrder(order.id)
          : await expireAdminOrder(order.id);
      setOrder(response.order);
      setSuccess(`Order was ${action === "cancel" ? "cancelled" : "expired"}.`);
    } catch (actionError) {
      setError(
        getAdminOrderErrorMessage(
          actionError,
          `The order could not be ${action === "cancel" ? "cancelled" : "expired"}.`,
        ),
      );
      setRequestId(getAdminOrderRequestId(actionError));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function updateFulfillment(status: OrderFulfillmentStatus) {
    if (!order || order.fulfillmentStatus === status) return;

    setBusyAction("fulfillment");
    setError(undefined);
    setRequestId(undefined);
    setSuccess(undefined);

    try {
      const response = await updateAdminOrderFulfillmentStatus(order.id, status);
      setOrder(response.order);
      setSuccess(`Fulfillment status updated to ${FULFILLMENT_LABELS[status]}.`);
    } catch (actionError) {
      setError(
        getAdminOrderErrorMessage(
          actionError,
          "Fulfillment status could not be updated.",
        ),
      );
      setRequestId(getAdminOrderRequestId(actionError));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function copyDelivery() {
    if (!order?.shippingRecipientName) return;

    const value = [
      order.shippingRecipientName,
      order.shippingPhone,
      formatShippingAddress(order),
      order.shippingNote,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Delivery information could not be copied.");
    }
  }

  if (isLoading && !order) {
    return (
      <div className="admin-resource">
        <section className="admin-resource__header">
          <h1>Loading order</h1>
        </section>
        <div className="admin-detail-loading" role="status">
          <span className="admin-skeleton-line admin-skeleton-line--wide" />
          <span className="admin-skeleton-line" />
          <span className="admin-skeleton-line admin-skeleton-line--wide" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="admin-resource">
        <section className="admin-resource__header">
          <h1>Order unavailable</h1>
        </section>
        {error ? (
          <AdminFeedback message={error} requestId={requestId} tone="error" />
        ) : null}
        <Link className="button button--secondary admin-back-link" href="/admin/orders">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-resource admin-resource--wide admin-order-detail">
      <section className="admin-order-hero" aria-labelledby="admin-order-detail-heading">
        <div className="admin-order-hero__copy">
          <div className="admin-order-hero__title-row">
            <h1 id="admin-order-detail-heading">
              Order {formatOrderDisplayId(order.id)}
            </h1>
            <AdminOrderStatusBadge status={order.status} />
          </div>
          <p>Placed on {formatDateTime(order.createdAt)}</p>
          <div className="admin-order-hero__badges" aria-label="Order status summary">
            <AdminFulfillmentStatusBadge status={order.fulfillmentStatus} />
            {order.payments[0] ? (
              <AdminPaymentStatusBadge status={order.payments[0].status} />
            ) : null}
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            className="button button--secondary"
            onClick={() => window.print()}
            type="button"
          >
            <Printer aria-hidden="true" size={17} />
            Print slip
          </button>
          {order.status === "PENDING_PAYMENT" ? (
            <>
              <button
                className="button button--secondary"
                disabled={Boolean(busyAction)}
                onClick={() => void transition("cancel")}
                type="button"
              >
                {busyAction === "cancel" ? "Cancelling" : "Cancel order"}
              </button>
              <button
                className="button button--secondary"
                disabled={Boolean(busyAction)}
                onClick={() => void transition("expire")}
                type="button"
              >
                {busyAction === "expire" ? "Expiring" : "Expire order"}
              </button>
            </>
          ) : null}
          <button
            className="button button--secondary"
            disabled={isLoading || Boolean(busyAction)}
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
        </div>
      </section>

      <AdminPaymentSafetyNote includeTransition />
      {success ? <AdminFeedback message={success} tone="success" /> : null}
      {error ? (
        <AdminFeedback message={error} requestId={requestId} tone="error" />
      ) : null}

      <section className="admin-order-summary-grid" aria-label="Order and customer summary">
        <article className="admin-detail-card admin-order-summary-card">
          <p className="eyebrow">Customer</p>
          <strong>{order.customerName || order.shippingRecipientName || "Not set"}</strong>
          <dl className="admin-detail-list admin-detail-list--compact">
            <Row
              label="Type"
              value={order.customerType === "GUEST" ? "Guest" : "Registered customer"}
            />
            <Row label="Email" value={order.customerEmail || "Not set"} />
            <Row
              label="Phone"
              value={order.customerPhone || order.shippingPhone || "Not set"}
            />
            {order.userId ? <Row label="User ID" value={order.userId} code /> : null}
          </dl>
        </article>

        <article className="admin-detail-card admin-order-summary-card">
          <div className="admin-detail-card__heading">
            <p className="eyebrow">Shipping Address</p>
            {order.shippingRecipientName ? (
              <button
                className="admin-link-button"
                onClick={() => void copyDelivery()}
                type="button"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>
          {order.shippingRecipientName ? (
            <dl className="admin-detail-list admin-detail-list--compact">
              <Row label="Recipient" value={order.shippingRecipientName} />
              <Row label="Phone" value={order.shippingPhone || "Not set"} />
              <Row label="Address" value={formatShippingAddress(order)} />
              {order.shippingNote ? (
                <Row label="Note" value={order.shippingNote} />
              ) : null}
            </dl>
          ) : (
            <p className="admin-detail-empty">
              Delivery information is unavailable for this historical order.
            </p>
          )}
        </article>

        <article className="admin-detail-card admin-order-summary-card">
          <p className="eyebrow">Payment Summary</p>
          <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
          <dl className="admin-detail-list admin-detail-list--compact">
            <Row
              label="Subtotal"
              value={formatCurrency(order.subtotalAmount, order.currency)}
            />
            <Row
              label="Discount"
              value={formatCurrency(order.discountAmount, order.currency)}
            />
            {order.voucherCodeSnapshot ? (
              <Row
                label="Voucher"
                value={`${order.voucherCodeSnapshot}${
                  order.voucherNameSnapshot ? ` - ${order.voucherNameSnapshot}` : ""
                }`}
              />
            ) : null}
            <Row label="Item quantity" value={String(order.itemCount)} />
            <Row label="Paid" value={formatDateTime(order.paidAt)} />
            <Row label="Fulfilled" value={formatDateTime(order.fulfilledAt)} />
          </dl>
        </article>
      </section>

      <FulfillmentStatusSection
        busy={busyAction === "fulfillment"}
        onUpdate={(status) => void updateFulfillment(status)}
        order={order}
      />

      <DetailSection
        eyebrow="Item snapshots"
        meta={`${order.items.length} records`}
        title="Order Items"
      >
        <div className="admin-order-items">
          {order.items.length === 0 ? (
            <p className="admin-detail-empty">No item snapshots were returned.</p>
          ) : (
            order.items.map((item) => (
              <article className="admin-order-item" key={item.id}>
                <OrderItemImage alt={item.productName} imageUrl={item.imageUrl} />
                <div className="admin-order-item__body">
                  <strong>{item.productName}</strong>
                  <span>{item.size} / {item.color}</span>
                  <span>{item.sku || "SKU not set"}</span>
                </div>
                <div className="admin-order-item__numbers">
                  <strong>{formatCurrency(item.unitPrice, order.currency)}</strong>
                  <span>Qty: {item.quantity}</span>
                  <span>{formatCurrency(item.lineTotal, order.currency)}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </DetailSection>

      <DetailSection
        eyebrow="Safe payment summaries"
        meta={`${order.payments.length} records`}
        title="Payments"
      >
        <div className="admin-table-wrap admin-table-wrap--commerce">
          <table className="admin-table admin-table--commerce">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Provider order code</th>
                <th>Failure reason</th>
                <th>Created</th>
                <th>Paid</th>
                <th>Cancelled</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={10}>
                    No payment summaries were returned.
                  </td>
                </tr>
              ) : (
                order.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <span className="admin-code">{payment.id}</span>
                    </td>
                    <td>{payment.provider}</td>
                    <td>
                      <AdminPaymentStatusBadge status={payment.status} />
                    </td>
                    <td>{formatCurrency(payment.amount, payment.currency)}</td>
                    <td>{formatOrderCode(payment.providerOrderCode)}</td>
                    <td>{payment.failureReason || "Not set"}</td>
                    <td>{formatDateTime(payment.createdAt)}</td>
                    <td>{formatDateTime(payment.paidAt)}</td>
                    <td>{formatDateTime(payment.cancelledAt)}</td>
                    <td>
                      <Link
                        className="admin-link-button"
                        href={`/admin/payments/${encodeURIComponent(payment.id)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DetailSection>

      <DetailSection
        eyebrow="Payment reconciliation required"
        meta={`${order.paymentReconciliationIssues.length} records`}
        title="Manual review issues"
      >
        <div className="admin-table-wrap admin-table-wrap--commerce">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Issue type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Amount</th>
                <th>Provider order code</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {order.paymentReconciliationIssues.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={6}>
                    No payment reconciliation issue is recorded for this order.
                  </td>
                </tr>
              ) : (
                order.paymentReconciliationIssues.map((issue) => (
                  <tr key={issue.id}>
                    <td>
                      <strong>{issue.type}</strong>
                    </td>
                    <td>{issue.status}</td>
                    <td>{issue.safeReason}</td>
                    <td>{formatCurrency(issue.amount, issue.currency)}</td>
                    <td>{formatOrderCode(issue.providerOrderCode)}</td>
                    <td>{formatDateTime(issue.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DetailSection>

      <DetailSection
        eyebrow="Reduced processing data"
        meta={`${order.webhookEvents.length} records`}
        title="Webhook processing summaries"
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Received</th>
                <th>Processed</th>
              </tr>
            </thead>
            <tbody>
              {order.webhookEvents.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={5}>
                    No webhook processing summaries were returned. Raw metadata and
                    signature hashes are never shown here.
                  </td>
                </tr>
              ) : (
                order.webhookEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <span className="admin-code">{event.id}</span>
                    </td>
                    <td>{event.provider}</td>
                    <td>{event.processingStatus}</td>
                    <td>{formatDateTime(event.receivedAt)}</td>
                    <td>{formatDateTime(event.processedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DetailSection>

      <Link className="button button--secondary admin-back-link" href="/admin/orders">
        Back to orders
      </Link>
    </div>
  );
}

function FulfillmentStatusSection({
  busy,
  onUpdate,
  order,
}: {
  busy: boolean;
  onUpdate: (status: OrderFulfillmentStatus) => void;
  order: AdminOrder;
}) {
  const locked = order.status !== "PAID";
  const helper =
    order.status === "PENDING_PAYMENT"
      ? "Fulfillment status can be updated after payment is confirmed."
      : order.status === "CANCELLED" || order.status === "EXPIRED"
        ? "Fulfillment updates are disabled for cancelled or expired orders."
        : "Update delivery progress without changing payment state.";

  return (
    <section className="admin-fulfillment-panel" aria-labelledby="update-status-heading">
      <div>
        <p className="eyebrow">Delivery progress</p>
        <h2 id="update-status-heading">Update Status</h2>
        <p>{helper}</p>
      </div>
      <div className="admin-fulfillment-actions" role="group" aria-label="Update fulfillment status">
        {FULFILLMENT_STEPS.map((step) => {
          const active = order.fulfillmentStatus === step.status;

          return (
            <button
              aria-pressed={active}
              className={`admin-fulfillment-button${active ? " is-active" : ""}`}
              disabled={busy || locked}
              key={step.status}
              onClick={() => onUpdate(step.status)}
              type="button"
            >
              {busy && active ? "Updating" : step.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AdminFulfillmentStatusBadge({
  status,
}: {
  status: OrderFulfillmentStatus;
}) {
  return (
    <span
      className={`fulfillment-status-badge fulfillment-status-badge--${status
        .toLowerCase()
        .replaceAll("_", "-")}`}
    >
      <Truck aria-hidden="true" size={14} />
      {FULFILLMENT_LABELS[status]}
    </span>
  );
}

function Row({
  code = false,
  label,
  value,
}: {
  code?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={code ? "admin-code" : undefined}>{value}</dd>
    </div>
  );
}

function DetailSection({
  children,
  eyebrow,
  meta,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  meta: string;
  title: string;
}) {
  return (
    <section className="admin-detail-section">
      <div className="admin-detail-section__header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{meta}</span>
      </div>
      {children}
    </section>
  );
}

function formatShippingAddress(order: AdminOrder): string {
  return (
    [
      order.shippingAddressLine,
      order.shippingWard,
      order.shippingDistrict,
      order.shippingProvince,
    ]
      .filter(Boolean)
      .join(", ") || "Not set"
  );
}
