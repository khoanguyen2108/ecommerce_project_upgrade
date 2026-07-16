"use client";

import { Check, Copy, Printer, RefreshCw, Truck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AdminFeedback,
  AdminOrderStatusBadge,
  AdminPaymentStatusBadge,
} from "@/components/admin/AdminCommerceUi";
import {
  cancelAdminOrder,
  expireAdminOrder,
  getAdminOrder,
  updateAdminOrderFulfillmentStatus,
} from "@/features/admin-orders/api";
import { requestAdminNavNotificationsRefresh } from "@/features/admin-notifications/events";
import {
  getAdminOrderErrorMessage,
  getAdminOrderRequestId,
} from "@/features/admin-orders/errors";
import type { AdminOrder } from "@/features/admin-orders/types";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatOrderCode,
  formatOrderDisplayId,
  getFulfillmentStatusLabel,
} from "@/components/orders/order-format";
import type { OrderFulfillmentStatus } from "@/features/orders/types";
import {
  localizeColorName,
  localizeProductName,
} from "@/features/catalog/localization";
import {
  getAdminOperationsTranslations,
  type AdminOperationsTranslations,
} from "@/features/i18n/admin-operations-translations";
import type { Locale } from "@/features/i18n/locale";
import { useI18n } from "@/features/i18n/useI18n";

const FULFILLMENT_STEPS: Array<Exclude<OrderFulfillmentStatus, "PENDING" | "RETURNED">> = [
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

type OrderAction = "cancel" | "expire";
type DetailErrorFallback = "copy" | "fulfillment" | "load" | OrderAction;

interface DetailUiError {
  cause: unknown;
  fallback: DetailErrorFallback;
}

type DetailSuccess =
  | { action: OrderAction; kind: "transition" }
  | { kind: "fulfillment"; status: OrderFulfillmentStatus };

export function AdminOrderDetailPage({ orderId }: { orderId: string }) {
  const { locale } = useI18n();
  const copy = getAdminOperationsTranslations(locale);
  const [order, setOrder] = useState<AdminOrder>();
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    "cancel" | "expire" | "fulfillment"
  >();
  const [error, setError] = useState<DetailUiError>();
  const [requestId, setRequestId] = useState<string>();
  const [success, setSuccess] = useState<DetailSuccess>();
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
          setError({ cause: loadError, fallback: "load" });
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

  async function transition(action: OrderAction) {
    if (!order || order.status !== "PENDING_PAYMENT") return;

    const confirmed = window.confirm(
      copy.orders.detail.confirmTransition(action, order.id),
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
      setSuccess({ action, kind: "transition" });
      requestAdminNavNotificationsRefresh();
    } catch (actionError) {
      setError({ cause: actionError, fallback: action });
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
      setSuccess({ kind: "fulfillment", status });
      requestAdminNavNotificationsRefresh();
    } catch (actionError) {
      setError({ cause: actionError, fallback: "fulfillment" });
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
      formatShippingAddress(order, copy.common.notSet),
      order.shippingNote,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError({ cause: undefined, fallback: "copy" });
    }
  }

  const errorMessage = error
    ? getAdminOrderErrorMessage(
        error.cause,
        error.fallback === "load"
          ? copy.orders.detail.loadError
          : error.fallback === "fulfillment"
            ? copy.orders.detail.fulfillmentError
            : error.fallback === "copy"
              ? copy.orders.detail.copyError
              : copy.orders.detail.transitionError(error.fallback),
        locale,
      )
    : undefined;
  const successMessage = success
    ? success.kind === "transition"
      ? copy.orders.detail.transitionSuccess(success.action)
      : copy.orders.detail.fulfillmentUpdated(
          getFulfillmentStatusLabel(success.status, locale),
        )
    : undefined;

  if (isLoading && !order) {
    return (
      <div className="admin-resource">
        <section className="admin-resource__header">
          <h1>{copy.orders.detail.loading}</h1>
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
          <h1>{copy.orders.detail.unavailable}</h1>
        </section>
        {errorMessage ? (
          <AdminFeedback message={errorMessage} requestId={requestId} tone="error" />
        ) : null}
        <Link className="button button--secondary admin-back-link" href="/admin/orders">
          {copy.orders.detail.backToOrders}
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
              {copy.orders.detail.orderTitle(
                formatOrderDisplayId(order.orderCode || order.id),
              )}
            </h1>
            <AdminOrderStatusBadge status={order.status} />
          </div>
          <p>{copy.orders.detail.placedOn(formatDateTime(order.createdAt, locale))}</p>
          <div
            className="admin-order-hero__badges"
            aria-label={copy.orders.detail.orderStatusSummaryAria}
          >
            <AdminFulfillmentStatusBadge
              locale={locale}
              status={order.fulfillmentStatus}
            />
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
            {copy.orders.detail.printSlip}
          </button>
          {order.status === "PENDING_PAYMENT" ? (
            <>
              <button
                className="button button--secondary"
                disabled={Boolean(busyAction)}
                onClick={() => void transition("cancel")}
                type="button"
              >
                {busyAction === "cancel"
                  ? copy.orders.detail.cancelling
                  : copy.orders.detail.cancelOrder}
              </button>
              <button
                className="button button--secondary"
                disabled={Boolean(busyAction)}
                onClick={() => void transition("expire")}
                type="button"
              >
                {busyAction === "expire"
                  ? copy.orders.detail.expiring
                  : copy.orders.detail.expireOrder}
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
            {copy.common.refresh}
          </button>
        </div>
      </section>

      {successMessage ? <AdminFeedback message={successMessage} tone="success" /> : null}
      {errorMessage ? (
        <AdminFeedback message={errorMessage} requestId={requestId} tone="error" />
      ) : null}

      <OrderSummaryTable
        copied={copied}
        copy={copy}
        locale={locale}
        onCopyDelivery={copyDelivery}
        order={order}
      />

      <FulfillmentStatusSection
        busy={busyAction === "fulfillment"}
        copy={copy}
        locale={locale}
        onUpdate={(status) => void updateFulfillment(status)}
        order={order}
      />

      <DetailSection
        eyebrow={copy.orders.detail.itemSnapshotsEyebrow}
        meta={copy.orders.detail.itemRecords(formatNumber(order.items.length, locale))}
        title={copy.orders.detail.orderItems}
      >
        <div className="admin-order-items">
          {order.items.length === 0 ? (
            <p className="admin-detail-empty">{copy.orders.detail.emptyItems}</p>
          ) : (
            order.items.map((item) => {
              const productName = localizeProductName(item.productName, locale);
              const colorName = localizeColorName(item.color, locale);

              return (
                <article className="admin-order-item" key={item.id}>
                  <OrderItemImage alt={productName} imageUrl={item.imageUrl} />
                  <div className="admin-order-item__body">
                    <strong>{productName}</strong>
                    <span>{item.size} / {colorName}</span>
                    <span>{item.sku || copy.orders.detail.skuNotSet}</span>
                  </div>
                  <div className="admin-order-item__numbers">
                    <strong>{formatCurrency(item.unitPrice, order.currency, locale)}</strong>
                    <span>
                      {copy.orders.detail.quantity(formatNumber(item.quantity, locale))}
                    </span>
                    <span>{formatCurrency(item.lineTotal, order.currency, locale)}</span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </DetailSection>

      <DetailSection
        eyebrow={copy.orders.detail.safePaymentEyebrow}
        meta={copy.orders.detail.paymentRecords(
          formatNumber(order.payments.length, locale),
        )}
        title={copy.orders.detail.payments}
      >
        <div className="admin-table-wrap admin-table-wrap--commerce">
          <table className="admin-table admin-table--commerce">
            <thead>
              <tr>
                <th>{copy.common.payment}</th>
                <th>{copy.common.provider}</th>
                <th>{copy.common.status}</th>
                <th>{copy.orders.detail.paymentAmount}</th>
                <th>{copy.orders.detail.providerOrderCode}</th>
                <th>{copy.orders.detail.failureReason}</th>
                <th>{copy.orders.detail.paymentCreated}</th>
                <th>{copy.orders.detail.paidPaymentColumn}</th>
                <th>{copy.orders.detail.cancelledPaymentColumn}</th>
                <th>{copy.orders.detail.paymentAction}</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={10}>
                    {copy.orders.detail.emptyPayments}
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
                    <td>{formatCurrency(payment.amount, payment.currency, locale)}</td>
                    <td>{formatOrderCode(payment.providerOrderCode, locale)}</td>
                    <td>{payment.failureReason || copy.common.notSet}</td>
                    <td>{formatDateTime(payment.createdAt, locale)}</td>
                    <td>{formatDateTime(payment.paidAt, locale)}</td>
                    <td>{formatDateTime(payment.cancelledAt, locale)}</td>
                    <td>
                      <Link
                        className="admin-link-button"
                        href={`/admin/payments/${encodeURIComponent(payment.id)}`}
                      >
                        {copy.common.view}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DetailSection>

      <Link className="button button--secondary admin-back-link" href="/admin/orders">
        {copy.orders.detail.backToOrders}
      </Link>
    </div>
  );
}

function OrderSummaryTable({
  copied,
  copy,
  locale,
  onCopyDelivery,
  order,
}: {
  copied: boolean;
  copy: AdminOperationsTranslations;
  locale: Locale;
  onCopyDelivery: () => Promise<void>;
  order: AdminOrder;
}) {
  const customerName =
    order.customerName || order.shippingRecipientName || copy.common.notSet;
  const customerPhone = order.customerPhone || order.shippingPhone || copy.common.notSet;
  const shippingAddress = formatShippingAddress(order, copy.common.notSet);
  const hasDelivery = Boolean(
    order.shippingRecipientName ||
      order.shippingAddressLine ||
      order.shippingWard ||
      order.shippingDistrict ||
      order.shippingProvince,
  );
  const hasDiscount = order.discountAmount > 0;

  return (
    <section className="admin-order-overview" aria-labelledby="admin-order-summary-heading">
      <div className="admin-detail-section__header admin-order-overview__header">
        <h2 id="admin-order-summary-heading">{copy.orders.detail.orderSummary}</h2>
        {hasDelivery ? (
          <button
            className="admin-link-button"
            onClick={() => void onCopyDelivery()}
            type="button"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? copy.orders.detail.copied : copy.orders.detail.copyDelivery}
          </button>
        ) : null}
      </div>
      <div className="admin-table-wrap admin-order-overview__table-wrap">
        <table className="admin-table admin-order-overview-table">
          <thead>
            <tr>
              <th>{copy.orders.detail.field}</th>
              <th>{copy.orders.detail.value}</th>
            </tr>
          </thead>
          <tbody>
            <SummaryRow label={copy.common.customer} value={customerName} />
            <SummaryRow label={copy.common.email} value={order.customerEmail || copy.common.notSet} />
            <SummaryRow label={copy.common.phone} value={customerPhone} />
            <SummaryRow label={copy.orders.detail.deliveryAddress} value={shippingAddress} />
            {order.shippingNote ? (
              <SummaryRow label={copy.orders.detail.deliveryNote} value={order.shippingNote} />
            ) : null}
            <SummaryRow
              label={copy.common.total}
              value={formatCurrency(order.totalAmount, order.currency, locale)}
            />
            {hasDiscount ? (
              <SummaryRow
                label={copy.orders.detail.discount}
                value={formatCurrency(order.discountAmount, order.currency, locale)}
              />
            ) : null}
            {order.voucherCodeSnapshot ? (
              <SummaryRow label={copy.orders.detail.voucher} value={order.voucherCodeSnapshot} />
            ) : null}
            <SummaryRow
              label={copy.common.items}
              value={copy.orders.detail.itemCount(
                formatNumber(order.itemCount, locale),
                order.itemCount === 1,
              )}
            />
            <SummaryRow
              label={copy.orders.detail.paidAt}
              value={formatDateTime(order.paidAt, locale)}
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FulfillmentStatusSection({
  busy,
  copy,
  locale,
  onUpdate,
  order,
}: {
  busy: boolean;
  copy: AdminOperationsTranslations;
  locale: Locale;
  onUpdate: (status: OrderFulfillmentStatus) => void;
  order: AdminOrder;
}) {
  const locked =
    order.status !== "PAID" || order.fulfillmentStatus === "RETURNED";
  const helper =
    order.fulfillmentStatus === "RETURNED"
      ? copy.orders.detail.fulfillmentHelper.returned
      : order.status === "PENDING_PAYMENT"
      ? copy.orders.detail.fulfillmentHelper.pendingPayment
      : order.status === "CANCELLED" || order.status === "EXPIRED"
        ? copy.orders.detail.fulfillmentHelper.cancelledOrExpired
        : copy.orders.detail.fulfillmentHelper.default;

  return (
    <section className="admin-fulfillment-panel" aria-labelledby="update-status-heading">
      <div>
        <p className="eyebrow">{copy.orders.detail.deliveryProgress}</p>
        <h2 id="update-status-heading">{copy.orders.detail.updateStatus}</h2>
        <p>{helper}</p>
      </div>
      <div
        className="admin-fulfillment-actions"
        role="group"
        aria-label={copy.orders.detail.updateStatusAria}
      >
        {FULFILLMENT_STEPS.map((status) => {
          const active = order.fulfillmentStatus === status;

          return (
            <button
              aria-pressed={active}
              className={`admin-fulfillment-button${active ? " is-active" : ""}`}
              disabled={busy || locked}
              key={status}
              onClick={() => onUpdate(status)}
              type="button"
            >
              {busy && active
                ? copy.orders.detail.updating
                : getFulfillmentStatusLabel(status, locale)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AdminFulfillmentStatusBadge({
  locale,
  status,
}: {
  locale: Locale;
  status: OrderFulfillmentStatus;
}) {
  return (
    <span
      className={`fulfillment-status-badge fulfillment-status-badge--${status
        .toLowerCase()
        .replaceAll("_", "-")}`}
    >
      <Truck aria-hidden="true" size={14} />
      {getFulfillmentStatusLabel(status, locale)}
    </span>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
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

function formatShippingAddress(order: AdminOrder, fallback: string): string {
  return (
    [
      order.shippingAddressLine,
      order.shippingWard,
      order.shippingDistrict,
      order.shippingProvince,
    ]
      .filter(Boolean)
      .join(", ") || fallback
  );
}
