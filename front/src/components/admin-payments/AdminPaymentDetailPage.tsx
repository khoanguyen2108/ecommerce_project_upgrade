"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AdminFeedback,
  AdminOrderStatusBadge,
  AdminPaymentSafetyNote,
  AdminPaymentStatusBadge,
} from "@/components/admin/AdminCommerceUi";
import { getAdminPayment } from "@/features/admin-payments/api";
import {
  getAdminPaymentErrorMessage,
  getAdminPaymentRequestId,
} from "@/features/admin-payments/errors";
import type { AdminPayment } from "@/features/admin-payments/types";
import {
  formatCurrency,
  formatDateTime,
  formatOrderCode,
} from "@/components/orders/order-format";

export function AdminPaymentDetailPage({ paymentId }: { paymentId: string }) {
  const [payment, setPayment] = useState<AdminPayment>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);
      try {
        const response = await getAdminPayment(paymentId);
        if (active) setPayment(response.payment);
      } catch (loadError) {
        if (active) {
          setPayment(undefined);
          setError(getAdminPaymentErrorMessage(loadError, "This payment diagnostic could not be loaded."));
          setRequestId(getAdminPaymentRequestId(loadError));
        }
      } finally { if (active) setIsLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [paymentId, refreshKey]);

  if (isLoading && !payment) {
    return <div className="admin-resource"><section className="admin-resource__header"><div><p className="eyebrow">Admin payment</p><h1>Loading payment</h1></div></section><div className="admin-detail-loading" role="status"><span className="admin-skeleton-line admin-skeleton-line--wide" /><span className="admin-skeleton-line" /><span className="admin-skeleton-line admin-skeleton-line--wide" /></div></div>;
  }

  if (!payment) {
    return <div className="admin-resource"><section className="admin-resource__header"><div><p className="eyebrow">Admin payment</p><h1>Payment unavailable</h1></div></section>{error ? <AdminFeedback message={error} requestId={requestId} tone="error" /> : null}<Link className="button button--secondary admin-back-link" href="/admin/payments">Back to payments</Link></div>;
  }

  return (
    <div className="admin-resource admin-resource--wide">
      <section className="admin-resource__header" aria-labelledby="admin-payment-detail-heading"><div><p className="eyebrow">Admin payment detail</p><h1 id="admin-payment-detail-heading">Payment <span className="admin-heading-code">{payment.id}</span></h1></div><button className="button button--secondary" disabled={isLoading} onClick={() => setRefreshKey((current) => current + 1)} type="button"><RefreshCw aria-hidden="true" className={isLoading ? "spin" : undefined} size={17} />Refresh</button></section>
      <AdminPaymentSafetyNote />
      {error ? <AdminFeedback message={error} requestId={requestId} tone="error" /> : null}

      <section className="admin-detail-grid" aria-label="Payment diagnostics summary">
        <article className="admin-detail-card"><p className="eyebrow">Safe payment details</p><AdminPaymentStatusBadge status={payment.status} /><dl className="admin-detail-list">
          <Row label="Provider" value={payment.provider} /><Row label="Amount" value={formatCurrency(payment.amount, payment.currency)} /><Row label="Currency" value={payment.currency} /><Row label="Provider order code" value={formatOrderCode(payment.providerOrderCode)} /><Row label="Payment link ID" value={payment.providerPaymentLinkId || "Not set"} code /><Row label="Transaction reference" value={payment.providerTransactionReference || "Not set"} code /><Row label="Failure reason" value={payment.failureReason || "Not set"} /><Row label="Checkout URL" value={payment.checkoutUrl ? "Recorded by backend (value hidden)" : "Not set"} /><Row label="Created" value={formatDateTime(payment.createdAt)} /><Row label="Updated" value={formatDateTime(payment.updatedAt)} /><Row label="Paid" value={formatDateTime(payment.paidAt)} /><Row label="Cancelled" value={formatDateTime(payment.cancelledAt)} />
        </dl></article>
        <article className="admin-detail-card"><p className="eyebrow">Order summary</p><AdminOrderStatusBadge status={payment.order.status} /><dl className="admin-detail-list"><Row label="Order ID" value={payment.order.id} code /><Row label="Total" value={formatCurrency(payment.order.totalAmount, payment.order.currency)} /><Row label="Subtotal" value={formatCurrency(payment.order.subtotalAmount, payment.order.currency)} /><Row label="Item quantity" value={String(payment.order.itemCount)} /><Row label="Created" value={formatDateTime(payment.order.createdAt)} /><Row label="Expires" value={formatDateTime(payment.order.expiresAt)} /></dl><Link className="admin-link-button" href={`/admin/orders/${encodeURIComponent(payment.order.id)}`}>Open order detail</Link></article>
        <article className="admin-detail-card"><p className="eyebrow">Customer summary</p><dl className="admin-detail-list"><Row label="Email" value={payment.user.email} /><Row label="Name" value={payment.user.name || "Not set"} /><Row label="Phone" value={payment.user.phone || "Not set"} /><Row label="User ID" value={payment.user.id} code /></dl></article>
      </section>

      <section className="admin-detail-section"><div className="admin-detail-section__header"><div><p className="eyebrow">Reduced processing data</p><h2>Webhook processing summaries</h2></div><span>{payment.webhookEvents.length} records</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Provider</th><th>Status</th><th>Order</th><th>Received</th><th>Processed</th></tr></thead><tbody>
        {payment.webhookEvents.length === 0 ? <tr><td className="admin-table__state" colSpan={6}>No webhook processing summaries were returned. Raw metadata and signature hashes are never shown here.</td></tr> : payment.webhookEvents.map((event) => <tr key={event.id}><td><span className="admin-code">{event.id}</span></td><td>{event.provider}</td><td>{event.processingStatus}</td><td><span className="admin-code">{event.orderId || "Not set"}</span></td><td>{formatDateTime(event.receivedAt)}</td><td>{formatDateTime(event.processedAt)}</td></tr>)}
      </tbody></table></div></section>

      <Link className="button button--secondary admin-back-link" href="/admin/payments">Back to payments</Link>
    </div>
  );
}

function Row({ code = false, label, value }: { code?: boolean; label: string; value: string }) { return <div><dt>{label}</dt><dd className={code ? "admin-code" : undefined}>{value}</dd></div>; }
