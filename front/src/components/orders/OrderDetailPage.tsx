"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CreditCard,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import { ReturnRequestModal } from "@/components/returns/ReturnRequestModal";
import { ReturnRequestStatusBadge } from "@/components/returns/ReturnRequestStatusBadge";
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
import { isImplicitAccessoryOption } from "@/features/catalog/sizes";
import { listMyReturnRequests } from "@/features/returns/api";
import type {
  Order,
  OrderFulfillmentStatus,
  PaymentSummary,
} from "@/features/orders/types";
import type { CustomerReturnRequest } from "@/features/returns/types";
import {
  localizeColorName,
  localizeProductName,
} from "@/features/catalog/localization";
import { useI18n } from "@/features/i18n/useI18n";

interface OrderDetailPageProps {
  orderId: string;
}
const FULFILLMENT_STEPS: Array<{
  status: OrderFulfillmentStatus;
}> = [
  { status: "PENDING" },
  { status: "PICKED_UP" },
  { status: "IN_TRANSIT" },
  { status: "OUT_FOR_DELIVERY" },
  { status: "DELIVERED" },
];

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const { locale, t } = useI18n();
  const [order, setOrder] = useState<Order>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [returnRequest, setReturnRequest] = useState<CustomerReturnRequest>();
  const [returnError, setReturnError] = useState<string>();
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);
      setReturnError(undefined);

      try {
        const response = await getOrder(orderId);

        if (isMounted) {
          setOrder(response.order);
        }

        try {
          const returnsResponse = await listMyReturnRequests();

          if (isMounted) {
            setReturnRequest(
              returnsResponse.returnRequests.find(
                (request) => request.orderCode === response.order.orderCode,
              ),
            );
          }
        } catch {
          if (isMounted) {
            setReturnRequest(undefined);
            setReturnError(t("orders.returnLoadError"));
          }
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setOrder(undefined);
        setError(
          getOrderErrorMessage(
            loadError,
            t("orders.detailLoadError"),
            locale,
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
  }, [locale, orderId, refreshKey, t]);

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
        {t("orders.back")}
      </Link>

      <header className="order-detail-heading" aria-labelledby="order-heading">
        <div className="order-detail-heading__copy">
          <p className="eyebrow">{t("orders.detail")}</p>
          <h1 id="order-heading">
            {t("return.order")} {formatOrderDisplayId(order.orderCode || order.id)}
          </h1>
          <p>{t("orders.placedOn")} {formatDate(order.createdAt, locale)}</p>
        </div>
        <div className="order-detail-heading__aside">
          <div className="order-detail-badges" aria-label={t("orders.statuses")}>
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
            {isLoading ? t("orders.refreshing") : t("orders.refresh")}
          </button>
        </div>
      </header>

      <div className="order-detail-layout">
        <div className="order-detail-main">
          <FulfillmentProgress order={order} />
          <ReturnRequestPanel
            error={returnError}
            onRequestReturn={() => setIsReturnModalOpen(true)}
            order={order}
            returnRequest={returnRequest}
          />
          <OrderItems order={order} />
        </div>

        <aside className="order-detail-sidebar" aria-label={t("orders.information")}>
          <OrderTotals order={order} />
          <ShippingAddress order={order} />
          <PaymentDetails currency={order.currency} payment={latestPayment} />
        </aside>
      </div>

      <ReturnRequestModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSubmitted={setReturnRequest}
        orderCode={order.orderCode}
      />
    </main>
  );
}

function ReturnRequestPanel({
  error,
  onRequestReturn,
  order,
  returnRequest,
}: {
  error?: string;
  onRequestReturn: () => void;
  order: Order;
  returnRequest?: CustomerReturnRequest;
}) {
  const { locale, t } = useI18n();
  if (
    order.fulfillmentStatus !== "DELIVERED" &&
    order.fulfillmentStatus !== "RETURNED"
  ) {
    return null;
  }

  return (
    <section className="order-detail-card order-return-card" aria-labelledby="return-request-heading">
      <div className="order-detail-card__heading">
        <div>
          <p className="eyebrow">{t("orders.afterDelivery")}</p>
          <h2 id="return-request-heading">{t("orders.returnRequest")}</h2>
        </div>
        <RotateCcw aria-hidden="true" size={22} />
      </div>

      {returnRequest ? (
        <div className="order-return-card__status">
          <ReturnRequestStatusBadge status={returnRequest.status} />
          <p>
            {t("orders.submitted")} {formatDate(returnRequest.createdAt, locale)} {t("orders.forOrder")} #{order.orderCode}.
          </p>
        </div>
      ) : order.fulfillmentStatus === "RETURNED" ? (
        <div className="order-return-card__status">
          <ReturnRequestStatusBadge status="APPROVED" />
          <p>{t("orders.approvedReturn")}</p>
        </div>
      ) : (
        <div className="order-return-card__action">
          <p>
            {t("orders.returnPrompt")}
          </p>
          <button className="button button--primary" onClick={onRequestReturn} type="button">
            {t("orders.requestReturn")}
          </button>
        </div>
      )}

      {error ? <p className="order-return-card__error" role="alert">{error}</p> : null}
    </section>
  );
}

function FulfillmentProgress({ order }: { order: Order }) {
  const { locale, t } = useI18n();
  const isReturned = order.fulfillmentStatus === "RETURNED";
  const activeIndex = isReturned
    ? FULFILLMENT_STEPS.length
    : FULFILLMENT_STEPS.findIndex(
        (step) => step.status === order.fulfillmentStatus,
      );
  const isInactive = order.status === "CANCELLED" || order.status === "EXPIRED";

  return (
    <section className="order-detail-card" aria-labelledby="shipping-progress-heading">
      <div className="order-detail-card__heading">
        <div>
          <p className="eyebrow">{t("orders.shippingProgress")}</p>
          <h2 id="shipping-progress-heading">
            {isInactive
              ? t("orders.fulfillmentStopped")
              : getFulfillmentStatusLabel(order.fulfillmentStatus, locale)}
          </h2>
        </div>
        <Truck aria-hidden="true" size={22} />
      </div>
      <p className="order-detail-card__intro">
        {isInactive
          ? t("orders.timelineInactive")
          : isReturned
            ? t("orders.returnedIntro")
          : t("orders.fulfillmentIntro")}
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
              <span className="fulfillment-progress__label">{getFulfillmentStatusLabel(step.status, locale)}</span>
              <small>
                {isComplete
                  ? t("orders.complete")
                  : isCurrent
                    ? step.status === "DELIVERED" && order.fulfilledAt
                      ? formatDate(order.fulfilledAt, locale)
                      : t("orders.current")
                    : t("orders.pending")}
              </small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OrderItems({ order }: { order: Order }) {
  const { locale, t } = useI18n();
  return (
    <section className="order-detail-card" aria-labelledby="order-items-heading">
      <div className="order-detail-card__heading">
        <div>
          <p className="eyebrow">{t("orders.yourPieces")}</p>
          <h2 id="order-items-heading">{t("orders.itemsInOrder")}</h2>
        </div>
        <span className="order-detail-count">
          {formatNumber(order.items.length, locale)} {order.items.length === 1 ? t("orders.item") : t("orders.items")}
        </span>
      </div>

      {order.items.length === 0 ? (
        <div className="order-detail-empty" role="status">
          <Package aria-hidden="true" size={24} />
          <strong>{t("orders.noItems")}</strong>
          <span>{t("orders.noItemSnapshots")}</span>
        </div>
      ) : (
        <div className="order-detail-items">
          {order.items.map((item) => {
            const showVariantOption = !isImplicitAccessoryOption(item);
            const productName = localizeProductName(item.productName, locale);
            const colorName = item.color
              ? localizeColorName(item.color, locale)
              : t("orders.colorNotSet");

            return (
              <article className="order-detail-item" key={item.id}>
                <OrderItemImage alt={productName} imageUrl={item.imageUrl} />
                <div className="order-detail-item__info">
                  <h3>{productName}</h3>
                  {showVariantOption ? (
                    <p>
                      <span>{colorName}</span>
                      <span>{item.size || t("orders.sizeNotSet")}</span>
                    </p>
                  ) : null}
                  {item.sku ? <small>SKU {item.sku}</small> : null}
                </div>
                <div className="order-detail-item__quantity">
                  <span>{t("orders.quantity")}</span>
                  <strong>{formatNumber(item.quantity, locale)}</strong>
                </div>
                <div className="order-detail-item__price">
                  <span>{formatCurrency(item.unitPrice, order.currency)} {t("orders.each")}</span>
                  <strong>{formatCurrency(item.lineTotal, order.currency)}</strong>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OrderTotals({ order }: { order: Order }) {
  const { t } = useI18n();
  return (
    <section className="order-detail-card order-detail-totals" aria-labelledby="totals-heading">
      <div className="order-detail-card__heading">
        <h2 id="totals-heading">{t("orders.summary")}</h2>
      </div>
      <dl>
        <div>
          <dt>{t("orders.subtotal")}</dt>
          <dd>{formatCurrency(order.subtotalAmount, order.currency)}</dd>
        </div>
        <div>
          <dt>{t("orders.discount")}</dt>
          <dd className={order.discountAmount > 0 ? "is-discount" : undefined}>
            {order.discountAmount > 0 ? "-" : ""}
            {formatCurrency(order.discountAmount, order.currency)}
          </dd>
        </div>
        {order.voucherCodeSnapshot ? (
          <div className="order-detail-voucher">
            <dt>{t("orders.voucher")}</dt>
            <dd>{order.voucherCodeSnapshot}</dd>
          </div>
        ) : null}
        <div className="order-detail-total">
          <dt>{t("orders.total")}</dt>
          <dd>{formatCurrency(order.totalAmount, order.currency)}</dd>
        </div>
      </dl>
    </section>
  );
}

function ShippingAddress({ order }: { order: Order }) {
  const { t } = useI18n();
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
        <h2 id="shipping-address-heading">{t("orders.shippingAddress")}</h2>
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
              {t("orders.note")}: {order.shippingNote}
            </span>
          ) : null}
        </address>
      ) : (
        <div className="order-detail-empty order-detail-empty--compact">
          {t("orders.addressUnavailable")}
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
  const { locale, t } = useI18n();
  return (
    <section className="order-detail-card" aria-labelledby="payment-details-heading">
      <div className="order-detail-card__heading order-detail-card__heading--icon">
        <span>
          <CreditCard aria-hidden="true" size={18} />
        </span>
        <h2 id="payment-details-heading">{t("orders.payment")}</h2>
      </div>
      {!payment ? (
        <div className="order-detail-empty order-detail-empty--compact">
          {t("orders.noPayment")}
        </div>
      ) : (
        <dl className="order-detail-payment-list">
          <div>
            <dt>{t("orders.provider")}</dt>
            <dd>{payment.provider}</dd>
          </div>
          <div>
            <dt>{t("orders.status")}</dt>
            <dd>
              <PaymentStatusBadge status={payment.status} />
            </dd>
          </div>
          <div>
            <dt>{t("orders.amount")}</dt>
            <dd>{formatCurrency(payment.amount, payment.currency || currency)}</dd>
          </div>
          <div>
            <dt>{t("orders.orderCode")}</dt>
            <dd>{formatOrderCode(payment.providerOrderCode, locale)}</dd>
          </div>
          {payment.paidAt ? (
            <div>
              <dt>{t("orders.paidAt")}</dt>
              <dd>{formatDateTime(payment.paidAt, locale)}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function OrderDetailLoading() {
  const { t } = useI18n();
  return (
    <main className="customer-page order-detail-page" aria-busy="true">
      <div className="order-detail-loading-back" />
      <section className="order-detail-loading-shell" role="status">
        <span className="sr-only">{t("orders.loadingDetail")}</span>
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
  const { t } = useI18n();
  return (
    <main className="customer-page order-detail-page">
      <Link className="order-detail-back" href="/orders">
        <ArrowLeft aria-hidden="true" size={17} />
        {t("orders.back")}
      </Link>
      <section className="order-detail-error" role="alert">
        <span className="order-detail-error__icon">
          <AlertCircle aria-hidden="true" size={28} />
        </span>
        <p className="eyebrow">{t("orders.detail")}</p>
        <h1>{t("orders.unavailable")}</h1>
        <p>{error || t("orders.notFound")}</p>
        {requestId ? <small>{t("orders.request")} {requestId}</small> : null}
        <div className="order-detail-error__actions">
          <Link className="button button--primary" href="/orders">
            {t("orders.viewMyOrders")}
          </Link>
          <Link className="button button--secondary" href="/products">
            {t("orders.continueShopping")}
          </Link>
        </div>
      </section>
    </main>
  );
}
