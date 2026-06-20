"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
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
} from "@/features/admin-orders/api";
import {
  getAdminOrderErrorMessage,
  getAdminOrderRequestId,
} from "@/features/admin-orders/errors";
import type { AdminOrder } from "@/features/admin-orders/types";
import {
  formatCurrency,
  formatDateTime,
  formatOrderCode,
} from "@/components/orders/order-format";

export function AdminOrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrder>();
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"cancel" | "expire">();
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
          setError(getAdminOrderErrorMessage(loadError, "This admin order could not be loaded."));
          setRequestId(getAdminOrderRequestId(loadError));
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [orderId, refreshKey]);

  async function transition(action: "cancel" | "expire") {
    if (!order || order.status !== "PENDING_PAYMENT") return;
    const confirmed = window.confirm(
      `Confirm ${action} for order ${order.id}? This does not call payOS and cannot mark the order paid.`,
    );
    if (!confirmed) return;

    setBusyAction(action);
    setError(undefined);
    setSuccess(undefined);
    try {
      const response = action === "cancel"
        ? await cancelAdminOrder(order.id)
        : await expireAdminOrder(order.id);
      setOrder(response.order);
      setSuccess(`Order was ${action === "cancel" ? "cancelled" : "expired"}.`);
    } catch (actionError) {
      setError(getAdminOrderErrorMessage(actionError, `The order could not be ${action === "cancel" ? "cancelled" : "expired"}.`));
      setRequestId(getAdminOrderRequestId(actionError));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function copyDelivery() {
    if (!order?.shippingRecipientName) return;
    const value = [order.shippingRecipientName, order.shippingPhone, formatShippingAddress(order), order.shippingNote].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Delivery information could not be copied.'); }
  }

  if (isLoading && !order) {
    return <div className="admin-resource"><section className="admin-resource__header"><h1>Loading order</h1></section><div className="admin-detail-loading" role="status"><span className="admin-skeleton-line admin-skeleton-line--wide" /><span className="admin-skeleton-line" /><span className="admin-skeleton-line admin-skeleton-line--wide" /></div></div>;
  }

  if (!order) {
    return <div className="admin-resource"><section className="admin-resource__header"><h1>Order unavailable</h1></section>{error ? <AdminFeedback message={error} requestId={requestId} tone="error" /> : null}<Link className="button button--secondary admin-back-link" href="/admin/orders">Back to orders</Link></div>;
  }

  return (
    <div className="admin-resource admin-resource--wide">
      <section className="admin-resource__header" aria-labelledby="admin-order-detail-heading">
        <h1 id="admin-order-detail-heading">Order <span className="admin-heading-code">{order.id}</span></h1>
        <div className="admin-header-actions">
          {order.status === "PENDING_PAYMENT" ? <>
            <button className="button button--secondary" disabled={Boolean(busyAction)} onClick={() => void transition("cancel")} type="button">{busyAction === "cancel" ? "Cancelling" : "Cancel order"}</button>
            <button className="button button--secondary" disabled={Boolean(busyAction)} onClick={() => void transition("expire")} type="button">{busyAction === "expire" ? "Expiring" : "Expire order"}</button>
          </> : null}
          <button className="button button--secondary" disabled={isLoading || Boolean(busyAction)} onClick={() => setRefreshKey((current) => current + 1)} type="button"><RefreshCw aria-hidden="true" className={isLoading ? "spin" : undefined} size={17} />Refresh</button>
        </div>
      </section>

      <AdminPaymentSafetyNote includeTransition />
      {success ? <AdminFeedback message={success} tone="success" /> : null}
      {error ? <AdminFeedback message={error} requestId={requestId} tone="error" /> : null}

      <section className="admin-detail-grid" aria-label="Order and customer summary">
        <article className="admin-detail-card"><p className="eyebrow">Order summary</p><AdminOrderStatusBadge status={order.status} /><dl className="admin-detail-list">
          <Row label="Subtotal" value={formatCurrency(order.subtotalAmount, order.currency)} /><Row label="Discount" value={formatCurrency(order.discountAmount, order.currency)} />{order.voucherCodeSnapshot ? <Row label="Voucher" value={`${order.voucherCodeSnapshot}${order.voucherNameSnapshot ? ` — ${order.voucherNameSnapshot}` : ""}`} /> : null}<Row label="Final total" value={formatCurrency(order.totalAmount, order.currency)} /><Row label="Item quantity" value={String(order.itemCount)} /><Row label="Currency" value={order.currency} /><Row label="Created" value={formatDateTime(order.createdAt)} /><Row label="Updated" value={formatDateTime(order.updatedAt)} /><Row label="Paid" value={formatDateTime(order.paidAt)} /><Row label="Cancelled" value={formatDateTime(order.cancelledAt)} /><Row label="Expires" value={formatDateTime(order.expiresAt)} />
        </dl></article>
        <article className="admin-detail-card"><p className="eyebrow">Customer summary</p><dl className="admin-detail-list"><Row label="Type" value={order.user ? "Registered customer" : "Guest"} /><Row label="Email" value={order.user?.email || order.guestEmail || "Not set"} /><Row label="Name" value={order.user?.name || order.shippingRecipientName || "Not set"} /><Row label="Phone" value={order.user?.phone || order.shippingPhone || "Not set"} />{order.user ? <Row label="User ID" value={order.user.id} code /> : null}</dl></article>
        <article className="admin-detail-card"><div className="admin-detail-card__heading"><p className="eyebrow">Delivery information</p>{order.shippingRecipientName ? <button className="admin-link-button" onClick={() => void copyDelivery()} type="button">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy address'}</button> : null}</div>{order.shippingRecipientName ? <dl className="admin-detail-list"><Row label="Recipient" value={order.shippingRecipientName} /><Row label="Phone" value={order.shippingPhone || 'Not set'} /><Row label="Address" value={formatShippingAddress(order)} />{order.shippingNote ? <Row label="Note" value={order.shippingNote} /> : null}</dl> : <p className="admin-detail-empty">Delivery information is unavailable for this historical order.</p>}</article>
      </section>

      <DetailSection eyebrow="Item snapshots" title="Items" meta={`${order.items.length} records`}>
        <div className="admin-table-wrap admin-table-wrap--commerce"><table className="admin-table"><thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Unit price</th><th>Quantity</th><th>Line total</th></tr></thead><tbody>
          {order.items.length === 0 ? <tr><td className="admin-table__state" colSpan={6}>No item snapshots were returned.</td></tr> : order.items.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong></td><td>{item.size} / {item.color}</td><td>{item.sku || "Not set"}</td><td>{formatCurrency(item.unitPrice, order.currency)}</td><td>{item.quantity}</td><td>{formatCurrency(item.lineTotal, order.currency)}</td></tr>)}
        </tbody></table></div>
      </DetailSection>

      <DetailSection eyebrow="Safe payment summaries" title="Payments" meta={`${order.payments.length} records`}>
        <div className="admin-table-wrap admin-table-wrap--commerce"><table className="admin-table admin-table--commerce"><thead><tr><th>Payment</th><th>Provider</th><th>Status</th><th>Amount</th><th>Provider order code</th><th>Failure reason</th><th>Created</th><th>Paid</th><th>Cancelled</th><th>Action</th></tr></thead><tbody>
          {order.payments.length === 0 ? <tr><td className="admin-table__state" colSpan={10}>No payment summaries were returned.</td></tr> : order.payments.map((payment) => <tr key={payment.id}><td><span className="admin-code">{payment.id}</span></td><td>{payment.provider}</td><td><AdminPaymentStatusBadge status={payment.status} /></td><td>{formatCurrency(payment.amount, payment.currency)}</td><td>{formatOrderCode(payment.providerOrderCode)}</td><td>{payment.failureReason || "Not set"}</td><td>{formatDateTime(payment.createdAt)}</td><td>{formatDateTime(payment.paidAt)}</td><td>{formatDateTime(payment.cancelledAt)}</td><td><Link className="admin-link-button" href={`/admin/payments/${encodeURIComponent(payment.id)}`}>View</Link></td></tr>)}
        </tbody></table></div>
      </DetailSection>

      <DetailSection eyebrow="Reduced processing data" title="Webhook processing summaries" meta={`${order.webhookEvents.length} records`}>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Provider</th><th>Status</th><th>Received</th><th>Processed</th></tr></thead><tbody>
          {order.webhookEvents.length === 0 ? <tr><td className="admin-table__state" colSpan={5}>No webhook processing summaries were returned. Raw metadata and signature hashes are never shown here.</td></tr> : order.webhookEvents.map((event) => <tr key={event.id}><td><span className="admin-code">{event.id}</span></td><td>{event.provider}</td><td>{event.processingStatus}</td><td>{formatDateTime(event.receivedAt)}</td><td>{formatDateTime(event.processedAt)}</td></tr>)}
        </tbody></table></div>
      </DetailSection>

      <Link className="button button--secondary admin-back-link" href="/admin/orders">Back to orders</Link>
    </div>
  );
}

function Row({ code = false, label, value }: { code?: boolean; label: string; value: string }) { return <div><dt>{label}</dt><dd className={code ? "admin-code" : undefined}>{value}</dd></div>; }

function DetailSection({ children, eyebrow, meta, title }: { children: ReactNode; eyebrow: string; meta: string; title: string }) { return <section className="admin-detail-section"><div className="admin-detail-section__header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>{children}</section>; }

function formatShippingAddress(order: AdminOrder): string { return [order.shippingAddressLine, order.shippingWard, order.shippingDistrict, order.shippingProvince].filter(Boolean).join(', ') || 'Not set'; }
