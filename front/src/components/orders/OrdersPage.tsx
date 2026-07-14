"use client";

import {
  AlertCircle,
  Eye,
  PackageOpen,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listOrders } from "@/features/orders/api";
import type { Order, OrderQuery, OrderStatus } from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import { PayosPaymentButton } from "@/components/payments/PayosPaymentButton";
import { useI18n } from "@/features/i18n/useI18n";
import type { Locale } from "@/features/i18n/locale";
import type { TranslationKey } from "@/features/i18n/translations";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatOrderDisplayId,
  getFulfillmentStatusClass,
  getFulfillmentStatusLabel,
  getOrderErrorMessage,
  getOrderRequestId,
  getOrderStatusClass,
  getOrderStatusLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  ORDER_STATUS_OPTIONS,
} from "@/components/orders/order-format";

const ORDER_LIMIT = 10;

interface OrdersPageProps {
  initialQuery: OrderQuery;
}

export function OrdersPage({ initialQuery }: OrdersPageProps) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState<OrderQuery>({
    ...initialQuery,
    limit: ORDER_LIMIT,
    page: initialQuery.page || 1,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: ORDER_LIMIT,
    page: query.page || 1,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response = await listOrders(query);

        if (!isMounted) {
          return;
        }

        setOrders(response.orders);
        setPagination(response.pagination);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setOrders([]);
        setError(
          getOrderErrorMessage(
            loadError,
            t("orders.loadError"),
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

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, [locale, query, refreshKey, t]);

  function handleStatusChange(status: OrderStatus | "") {
    setQuery((current) => ({
      ...current,
      page: 1,
      status: status || undefined,
    }));
  }

  function goToPage(page: number) {
    setQuery((current) => ({
      ...current,
      page,
    }));
  }

  const hasFilters = Boolean(query.status);
  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <main className="customer-page orders-page">
      <section
        className="customer-hero orders-hero"
        aria-labelledby="orders-heading"
      >
        <div>
          <h1 id="orders-heading">{t("orders.title")}</h1>
          <p>{t("orders.intro")}</p>
        </div>
      </section>

      <section
        className="customer-resource orders-resource"
        aria-label={t("orders.listLabel")}
      >
        <div className="customer-toolbar orders-toolbar">
          <label>
            <span>{t("orders.status")}</span>
            <select
              disabled={isLoading}
              onChange={(event) =>
                handleStatusChange(event.target.value as OrderStatus | "")
              }
              value={query.status || ""}
            >
              <option value="">{t("orders.allStatuses")}</option>
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getOrderStatusLabel(status, locale)}
                </option>
              ))}
            </select>
          </label>

          <div className="customer-toolbar__actions">
            <button
              className="button button--secondary"
              disabled={!hasFilters || isLoading}
              onClick={() => setQuery({ limit: ORDER_LIMIT, page: 1 })}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={17} />
              {t("orders.reset")}
            </button>
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
              {t("orders.refresh")}
            </button>
          </div>
        </div>

        {error ? (
          <CustomerFeedback
            message={error}
            onRetry={() => setRefreshKey((current) => current + 1)}
            requestId={requestId}
          />
        ) : null}

        {isLoading ? <OrderCardSkeleton rows={5} /> : null}

        {!isLoading && !error && orders.length === 0 ? (
          <OrdersEmptyState />
        ) : null}

        {!isLoading && !error && orders.length > 0 ? (
          <div className="customer-order-list">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : null}

        <nav className="customer-pagination" aria-label={t("orders.pagination")}>
          <button
            className="button button--secondary"
            disabled={isLoading || pagination.page <= 1}
            onClick={() => goToPage(Math.max(1, pagination.page - 1))}
            type="button"
          >
            {t("common.previous")}
          </button>
          <span>
            {t("orders.page")} {pagination.page} {t("orders.of")} {totalPages} ({formatNumber(pagination.total, locale)}{" "}
            {pagination.total === 1 ? t("orders.order") : t("orders.orders")})
          </span>
          <button
            className="button button--secondary"
            disabled={isLoading || pagination.page >= totalPages}
            onClick={() => goToPage(pagination.page + 1)}
            type="button"
          >
            {t("common.next")}
          </button>
        </nav>
      </section>
    </main>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { locale, t } = useI18n();
  const itemCount = getOrderItemCount(order);
  const itemSummary = getOrderItemSummary(order, locale, t);
  const createdDate = formatDate(order.createdAt, locale);
  const canRetryPayment = order.status === "PENDING_PAYMENT";

  return (
    <article className="customer-order-card">
      <OrderProductPreview order={order} />

      <div className="customer-order-card__body">
        <div className="customer-order-card__heading">
          <h2>{formatOrderDisplayId(order.orderCode || order.id)}</h2>
          <time dateTime={order.createdAt}>{createdDate}</time>
        </div>
        <p>{itemSummary}</p>
        <div className="customer-order-card__badges" aria-label={t("orders.states")}>
          <OrderStatusBadge status={order.status} />
          <FulfillmentStatusBadge status={order.fulfillmentStatus} />
        </div>
      </div>

      <div className="customer-order-card__meta">
        <div>
          <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
          <span>{formatItemCount(itemCount, locale, t)}</span>
        </div>
        <div className="customer-order-card__actions">
          <Link
            aria-label={`${t("orders.viewDetails")} ${formatOrderDisplayId(order.orderCode || order.id)}`}
            className="button button--secondary customer-order-card__button"
            href={`/orders/${encodeURIComponent(order.orderCode || order.id)}`}
          >
            <Eye aria-hidden="true" size={17} />
            {t("orders.viewDetails")}
          </Link>
          {canRetryPayment ? (
            <PayosPaymentButton
              className="button button--primary customer-order-card__button"
              label={t("orders.retryPayment")}
              orderId={order.id}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function OrderProductPreview({ order }: { order: Order }) {
  const { t } = useI18n();
  const firstItem = order.items?.[0];
  const additionalItems = Math.max(0, (order.items?.length ?? 0) - 1);

  return (
    <div className="order-product-preview">
      <OrderItemImage
        alt={firstItem?.productName || t("orders.productFallback")}
        imageUrl={firstItem?.imageUrl}
        size="compact"
      />
      {additionalItems > 0 ? (
        <span aria-label={`${additionalItems} ${t("orders.moreProducts")}`}>
          +{additionalItems}
        </span>
      ) : null}
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { locale } = useI18n();
  return (
    <span className={`order-status-badge ${getOrderStatusClass(status)}`}>
      {getOrderStatusLabel(status, locale)}
    </span>
  );
}

export function PaymentStatusBadge({
  status,
}: {
  status: Order["payments"][number]["status"];
}) {
  const { locale } = useI18n();
  return (
    <span className={`payment-status-badge ${getPaymentStatusClass(status)}`}>
      {getPaymentStatusLabel(status, locale)}
    </span>
  );
}

export function FulfillmentStatusBadge({
  status,
}: {
  status: Order["fulfillmentStatus"];
}) {
  const { locale } = useI18n();
  return (
    <span className={`fulfillment-status-badge ${getFulfillmentStatusClass(status)}`}>
      {getFulfillmentStatusLabel(status, locale)}
    </span>
  );
}

function CustomerFeedback({
  message,
  onRetry,
  requestId,
}: {
  message: string;
  onRetry: () => void;
  requestId?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="customer-feedback customer-feedback--error" role="alert">
      <AlertCircle aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>{t("orders.request")} {requestId}</small> : null}
      <button
        className="button button--secondary"
        onClick={onRetry}
        type="button"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}

function OrdersEmptyState() {
  const { t } = useI18n();
  return (
    <div className="orders-empty-state">
      <span aria-hidden="true">
        <PackageOpen size={30} />
      </span>
      <div>
        <h2>{t("orders.emptyTitle")}</h2>
        <p>{t("orders.emptyBody")}</p>
      </div>
      <Link className="button button--primary" href="/products">
        {t("orders.startShopping")}
      </Link>
    </div>
  );
}

function OrderCardSkeleton({ rows }: { rows: number }) {
  const { t } = useI18n();
  return (
    <div className="customer-order-list" role="status" aria-label={t("orders.loading")}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <article
          className="customer-order-card customer-order-card--skeleton"
          key={rowIndex}
        >
          <span className="customer-skeleton-line customer-order-card__image-skeleton" />
          <div className="customer-order-card__body">
            <span className="customer-skeleton-line customer-skeleton-line--wide" />
            <span className="customer-skeleton-line" />
            <span className="customer-skeleton-line customer-order-card__badge-skeleton" />
          </div>
          <div className="customer-order-card__meta">
            <span className="customer-skeleton-line" />
            <span className="customer-skeleton-line" />
          </div>
        </article>
      ))}
    </div>
  );
}

function getOrderItemSummary(
  order: Order,
  locale: Locale,
  t: (key: TranslationKey) => string,
): string {
  const firstItem = order.items?.[0];

  if (!firstItem) {
    return t("orders.itemsUnavailable");
  }

  const additionalItems = Math.max(0, order.items.length - 1);

  return additionalItems > 0
    ? `${firstItem.productName} + ${formatNumber(additionalItems, locale)} ${
        additionalItems === 1 ? t("orders.moreItem") : t("orders.moreItems")
      }`
    : firstItem.productName;
}

function getOrderItemCount(order: Order): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

function formatItemCount(
  count: number,
  locale: Locale,
  t: (key: TranslationKey) => string,
): string {
  return `${formatNumber(count, locale)} ${count === 1 ? t("orders.item") : t("orders.items")}`;
}
