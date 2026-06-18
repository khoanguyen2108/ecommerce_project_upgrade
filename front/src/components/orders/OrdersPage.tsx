"use client";

import { AlertCircle, Eye, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listOrders } from "@/features/orders/api";
import type { Order, OrderQuery, OrderStatus } from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getLatestPayment,
  getOrderErrorMessage,
  getOrderRequestId,
  getOrderStatusClass,
  getPaymentStatusClass,
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
    <main className="customer-page">
      <section className="customer-hero" aria-labelledby="orders-heading">
        <p className="eyebrow">Account</p>
        <h1 id="orders-heading">Orders</h1>
        <p>View order records and payment state confirmed by Belikeme.</p>
      </section>

      <section className="customer-resource" aria-label="Order list">
        <div className="customer-toolbar">
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
                  {status}
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
          <CustomerFeedback message={error} requestId={requestId} />
        ) : null}

        <div className="order-table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>Products</th>
                <th>Order</th>
                <th>Status</th>
                <th>Total</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <OrderTableSkeleton columns={8} rows={5} /> : null}
              {!isLoading && !error && orders.length === 0 ? (
                <tr>
                  <td className="order-table__state" colSpan={8}>
                    No orders are visible for this account yet.
                  </td>
                </tr>
              ) : null}
              {!isLoading && !error
                ? orders.map((order) => {
                    const latestPayment = getLatestPayment(order);

                    return (
                      <tr key={order.id}>
                        <td>
                          <OrderProductPreview order={order} />
                        </td>
                        <td>
                          <span className="order-id">{order.id}</span>
                        </td>
                        <td>
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td>{formatCurrency(order.totalAmount, order.currency)}</td>
                        <td>{formatNumber(order.items?.length ?? 0)}</td>
                        <td>
                          {latestPayment ? (
                            <PaymentStatusBadge status={latestPayment.status} />
                          ) : (
                            <span className="order-table__muted">Not set</span>
                          )}
                        </td>
                        <td>{formatDateTime(order.createdAt)}</td>
                        <td>
                          <Link
                            aria-label={`View order ${order.id}`}
                            className="icon-button order-icon-button"
                            href={`/orders/${encodeURIComponent(order.id)}`}
                            title="View order"
                          >
                            <Eye aria-hidden="true" size={17} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

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
      {status}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: Order["payments"][number]["status"] }) {
  return (
    <span className={`payment-status-badge ${getPaymentStatusClass(status)}`}>
      {status}
    </span>
  );
}

function CustomerFeedback({
  message,
  requestId,
}: {
  message: string;
  requestId?: string;
}) {
  return (
    <div className="customer-feedback customer-feedback--error" role="alert">
      <AlertCircle aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>Request {requestId}</small> : null}
    </div>
  );
}

function OrderTableSkeleton({
  columns,
  rows,
}: {
  columns: number;
  rows: number;
}) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <tr aria-hidden="true" key={rowIndex}>
      {Array.from({ length: columns }, (_, columnIndex) => (
        <td key={columnIndex}>
          <span className="customer-skeleton-line" />
        </td>
      ))}
    </tr>
  ));
}
