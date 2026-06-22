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
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatOrderDisplayId,
  getLatestPayment,
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
            "Orders could not be loaded right now.",
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
  }, [query, refreshKey]);

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
          <h1 id="orders-heading">MY ORDERS</h1>
          <p>Track, manage, and review your recent Belikeme purchases.</p>
        </div>
      </section>

      <section
        className="customer-resource orders-resource"
        aria-label="Order list"
      >
        <div className="customer-toolbar orders-toolbar">
          <label>
            <span>Status</span>
            <select
              disabled={isLoading}
              onChange={(event) =>
                handleStatusChange(event.target.value as OrderStatus | "")
              }
              value={query.status || ""}
            >
              <option value="">All statuses</option>
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getOrderStatusLabel(status)}
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
              Reset
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
              Refresh
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

        <nav className="customer-pagination" aria-label="Orders pagination">
          <button
            className="button button--secondary"
            disabled={isLoading || pagination.page <= 1}
            onClick={() => goToPage(Math.max(1, pagination.page - 1))}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {totalPages} ({formatNumber(pagination.total)}{" "}
            orders)
          </span>
          <button
            className="button button--secondary"
            disabled={isLoading || pagination.page >= totalPages}
            onClick={() => goToPage(pagination.page + 1)}
            type="button"
          >
            Next
          </button>
        </nav>
      </section>
    </main>
  );
}

function OrderCard({ order }: { order: Order }) {
  const latestPayment = getLatestPayment(order);
  const itemCount = getOrderItemCount(order);
  const itemSummary = getOrderItemSummary(order);
  const createdDate = formatDate(order.createdAt);
  const canRetryPayment = order.status === "PENDING_PAYMENT";

  return (
    <article className="customer-order-card">
      <OrderProductPreview order={order} />

      <div className="customer-order-card__body">
        <div className="customer-order-card__heading">
          <h2>{formatOrderDisplayId(order.id)}</h2>
          <time dateTime={order.createdAt}>{createdDate}</time>
        </div>
        <p>{itemSummary}</p>
        <div className="customer-order-card__badges" aria-label="Order states">
          <OrderStatusBadge status={order.status} />
          {latestPayment ? (
            <PaymentStatusBadge status={latestPayment.status} />
          ) : (
            <span className="payment-status-badge payment-status-badge--unset">
              Payment not set
            </span>
          )}
        </div>
      </div>

      <div className="customer-order-card__meta">
        <div>
          <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
          <span>{formatItemCount(itemCount)}</span>
        </div>
        <div className="customer-order-card__actions">
          <Link
            aria-label={`View details for order ${order.id}`}
            className="button button--secondary customer-order-card__button"
            href={`/orders/${encodeURIComponent(order.id)}`}
          >
            <Eye aria-hidden="true" size={17} />
            View details
          </Link>
          {canRetryPayment ? (
            <PayosPaymentButton
              className="button button--primary customer-order-card__button"
              label="Retry payment"
              orderId={order.id}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function OrderProductPreview({ order }: { order: Order }) {
  const firstItem = order.items?.[0];
  const additionalItems = Math.max(0, (order.items?.length ?? 0) - 1);

  return (
    <div className="order-product-preview">
      <OrderItemImage
        alt={firstItem?.productName || "Order product"}
        imageUrl={firstItem?.imageUrl}
        size="compact"
      />
      {additionalItems > 0 ? (
        <span aria-label={`${additionalItems} more products`}>
          +{additionalItems}
        </span>
      ) : null}
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`order-status-badge ${getOrderStatusClass(status)}`}>
      {getOrderStatusLabel(status)}
    </span>
  );
}

export function PaymentStatusBadge({
  status,
}: {
  status: Order["payments"][number]["status"];
}) {
  return (
    <span className={`payment-status-badge ${getPaymentStatusClass(status)}`}>
      {getPaymentStatusLabel(status)}
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
  return (
    <div className="customer-feedback customer-feedback--error" role="alert">
      <AlertCircle aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>Request {requestId}</small> : null}
      <button
        className="button button--secondary"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

function OrdersEmptyState() {
  return (
    <div className="orders-empty-state">
      <span aria-hidden="true">
        <PackageOpen size={30} />
      </span>
      <div>
        <h2>No orders yet</h2>
        <p>Your Belikeme order history will appear here after checkout.</p>
      </div>
      <Link className="button button--primary" href="/products">
        Start shopping
      </Link>
    </div>
  );
}

function OrderCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="customer-order-list" role="status" aria-label="Loading orders">
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

function getOrderItemSummary(order: Order): string {
  const firstItem = order.items?.[0];

  if (!firstItem) {
    return "Order item snapshots are unavailable.";
  }

  const additionalItems = Math.max(0, order.items.length - 1);

  return additionalItems > 0
    ? `${firstItem.productName} + ${formatNumber(additionalItems)} more item${
        additionalItems === 1 ? "" : "s"
      }`
    : firstItem.productName;
}

function getOrderItemCount(order: Order): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

function formatItemCount(count: number): string {
  return `${formatNumber(count)} item${count === 1 ? "" : "s"}`;
}
