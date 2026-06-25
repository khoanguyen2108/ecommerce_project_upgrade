"use client";

import {
  AlertCircle,
  Eye,
  Inbox,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AdminFeedback,
  AdminPagination,
  AdminPaymentStatusBadge,
} from "@/components/admin/AdminCommerceUi";
import {
  cancelAdminOrder,
  expireAdminOrder,
  listAdminOrders,
} from "@/features/admin-orders/api";
import {
  getAdminOrderErrorMessage,
  getAdminOrderRequestId,
} from "@/features/admin-orders/errors";
import type {
  AdminOrderQuery,
  AdminOrderSort,
  AdminOrderSortDirection,
  AdminOrderSummary,
} from "@/features/admin-orders/types";
import type {
  OrderFulfillmentStatus,
  OrderStatus,
} from "@/features/orders/types";
import { ApiClientError } from "@/lib/errors/api-error";
import type { Pagination } from "@/lib/api/types";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatOrderDisplayId,
  getFulfillmentStatusClass,
  getFulfillmentStatusLabel,
  getOrderStatusLabel,
} from "@/components/orders/order-format";

const LIMIT = 8;
const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CANCELLED",
  "EXPIRED",
];
const FULFILLMENT_STATUSES: OrderFulfillmentStatus[] = [
  "PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export function AdminOrdersPage({
  initialQuery,
}: {
  initialQuery: AdminOrderQuery;
}) {
  const [query, setQuery] = useState<AdminOrderQuery>({
    ...initialQuery,
    limit: LIMIT,
    page: initialQuery.page || 1,
  });
  const [searchInput, setSearchInput] = useState(initialQuery.search || "");
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: LIMIT,
    page: initialQuery.page || 1,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(undefined);
      setErrorCode(undefined);
      setRequestId(undefined);

      try {
        const response = await listAdminOrders(query);
        if (active) {
          const validPage = Math.min(
            query.page || 1,
            Math.max(1, response.pagination.totalPages),
          );

          if (validPage !== (query.page || 1)) {
            setQuery((current) => ({ ...current, page: validPage }));
            return;
          }

          setOrders(response.orders);
          setPagination(response.pagination);
        }
      } catch (loadError) {
        if (active) {
          setOrders([]);
          setError(
            getAdminOrderErrorMessage(
              loadError,
              "Admin orders could not be loaded right now.",
            ),
          );
          setErrorCode(
            loadError instanceof ApiClientError ? loadError.code : undefined,
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
  }, [query, refreshKey]);

  function updateQuery(next: Partial<AdminOrderQuery>) {
    setQuery((current) => ({ ...current, ...next, page: 1 }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQuery({ search: searchInput.trim() || undefined });
  }

  function resetFilters() {
    setSearchInput("");
    setQuery({ limit: LIMIT, order: "desc", page: 1, sort: "createdAt" });
  }

  async function transition(
    order: AdminOrderSummary,
    action: "cancel" | "expire",
  ) {
    if (order.status !== "PENDING_PAYMENT") return;

    const verb = action === "cancel" ? "cancel" : "expire";
    const confirmed = window.confirm(
      `Confirm ${verb} for order ${order.id}? This changes only the local pending order/payment state and does not call payOS.`,
    );
    if (!confirmed) return;

    setBusyAction(`${order.id}:${action}`);
    setError(undefined);
    setErrorCode(undefined);
    setSuccess(undefined);
    setRequestId(undefined);

    try {
      if (action === "cancel") await cancelAdminOrder(order.id);
      else await expireAdminOrder(order.id);
      setSuccess(
        `Order ${formatOrderDisplayId(order.id)} was ${
          action === "cancel" ? "cancelled" : "expired"
        }.`,
      );
      setRefreshKey((current) => current + 1);
    } catch (actionError) {
      setError(
        getAdminOrderErrorMessage(
          actionError,
          `The order could not be ${
            action === "cancel" ? "cancelled" : "expired"
          }.`,
        ),
      );
      setErrorCode(
        actionError instanceof ApiClientError ? actionError.code : undefined,
      );
      setRequestId(getAdminOrderRequestId(actionError));
    } finally {
      setBusyAction(undefined);
    }
  }

  const hasFilters = Boolean(
    query.status ||
      query.fulfillmentStatus ||
      query.search ||
      query.from ||
      query.to ||
      query.sort !== "createdAt" ||
      query.order !== "desc",
  );
  const metrics = getPageMetrics(orders, pagination.total);
  const isAccessDenied = errorCode === "FORBIDDEN";

  return (
    <div className="admin-resource admin-resource--full-width admin-orders-management">
      <section className="admin-orders-hero" aria-labelledby="admin-orders-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">COMMERCE OPERATIONS</p>
          <h1 id="admin-orders-heading">Orders Management</h1>
          <p>Review order, customer, payment, and fulfillment state.</p>
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

      <section className="admin-orders-kpis" aria-label="Current order summary">
        <MetricCard label="Total orders" meta="Matching filters" value={metrics.total} />
        <MetricCard label="Paid orders" meta="Current page" value={metrics.paid} />
        <MetricCard label="Pending payment" meta="Current page" value={metrics.pending} />
        <MetricCard label="Needs fulfillment" meta="Current page" value={metrics.inProgress} />
        <MetricCard label="Delivered" meta="Current page" value={metrics.delivered} />
      </section>

      <section className="admin-orders-filter-panel" aria-label="Order filters">
        <form className="admin-orders-search" onSubmit={submitSearch}>
          <label htmlFor="admin-order-search">Search</label>
          <div>
            <input
              id="admin-order-search"
              maxLength={160}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Customer email, order ID, or payOS code"
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              Search
            </button>
          </div>
        </form>

        <div className="admin-orders-filters">
          <FilterSelect
            label="Status"
            onChange={(value) =>
              updateQuery({
                status: (value || undefined) as OrderStatus | undefined,
              })
            }
            value={query.status || ""}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Fulfillment"
            onChange={(value) =>
              updateQuery({
                fulfillmentStatus: (value || undefined) as
                  | OrderFulfillmentStatus
                  | undefined,
              })
            }
            value={query.fulfillmentStatus || ""}
          >
            <option value="">All fulfillment</option>
            {FULFILLMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getFulfillmentStatusLabel(status)}
              </option>
            ))}
          </FilterSelect>
          <DateFilter
            label="From"
            onChange={(value) => updateQuery({ from: value || undefined })}
            value={query.from || ""}
          />
          <DateFilter
            label="To"
            onChange={(value) => updateQuery({ to: value || undefined })}
            value={query.to || ""}
          />
          <FilterSelect
            label="Sort field"
            onChange={(value) => updateQuery({ sort: value as AdminOrderSort })}
            value={query.sort || "createdAt"}
          >
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="totalAmount">Total</option>
            <option value="paidAt">Paid time</option>
          </FilterSelect>
          <FilterSelect
            label="Sort order"
            onChange={(value) =>
              updateQuery({ order: value as AdminOrderSortDirection })
            }
            value={query.order || "desc"}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </FilterSelect>
          <button
            className="button button--secondary"
            disabled={!hasFilters || isLoading}
            onClick={resetFilters}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            Reset
          </button>
        </div>
      </section>

      {success ? <AdminFeedback message={success} tone="success" /> : null}
      {isAccessDenied ? (
        <AccessDeniedState message={error} requestId={requestId} />
      ) : error ? (
        <AdminFeedback message={error} requestId={requestId} tone="error" />
      ) : null}

      <section className="admin-orders-list" aria-label="Admin orders list">
        <div className="admin-orders-list__head" aria-hidden="true">
          <span>Order</span>
          <span>Customer</span>
          <span>Fulfillment</span>
          <span>Payment</span>
          <span>Total</span>
          <span>Items</span>
          <span>Created</span>
          <span>Actions</span>
        </div>

        {isLoading ? <OrderListSkeleton rows={6} /> : null}

        {!isLoading && !error && orders.length === 0 ? (
          <EmptyOrdersState disabled={!hasFilters} onReset={resetFilters} />
        ) : null}

        {!isLoading && !error
          ? orders.map((order) => (
              <OrderRow
                busyAction={busyAction}
                key={order.id}
                onTransition={transition}
                order={order}
              />
            ))
          : null}
      </section>

      <AdminPagination
        isLoading={isLoading}
        noun="orders"
        onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
        pagination={pagination}
      />
    </div>
  );
}

function OrderRow({
  busyAction,
  onTransition,
  order,
}: {
  busyAction?: string;
  onTransition: (
    order: AdminOrderSummary,
    action: "cancel" | "expire",
  ) => Promise<void>;
  order: AdminOrderSummary;
}) {
  const customerLabel =
    order.customerName || order.customerEmail || order.shippingRecipientName || "Not set";
  const customerMeta = [
    order.customerType === "GUEST" ? "Guest" : "Registered",
    order.customerEmail,
    order.customerPhone,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="admin-orders-row">
      <div className="admin-orders-cell admin-orders-cell--order">
        <span className="admin-orders-mobile-label">Order</span>
        <strong>{formatOrderDisplayId(order.id)}</strong>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">Customer</span>
        <strong>{customerLabel}</strong>
        <small>{customerMeta || "Customer details unavailable"}</small>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">Fulfillment</span>
        <AdminFulfillmentStatusBadge status={order.fulfillmentStatus} />
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">Payment</span>
        {order.latestPayment ? (
          <>
            <AdminPaymentStatusBadge status={order.latestPayment.status} />
            <small>payOS {order.latestPayment.providerOrderCode}</small>
          </>
        ) : (
          <span className="admin-table__muted">Not set</span>
        )}
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">Total</span>
        <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">Items</span>
        <span>{formatNumber(order.itemCount)}</span>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">Created</span>
        <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
      </div>
      <div className="admin-orders-actions">
        <Link
          aria-label={`View order ${order.id}`}
          className="button button--secondary admin-orders-view"
          href={`/admin/orders/${encodeURIComponent(order.id)}`}
        >
          <Eye aria-hidden="true" size={17} />
          View details
        </Link>
        {order.status === "PENDING_PAYMENT" ? (
          <div className="admin-orders-inline-actions">
            <button
              className="admin-link-button"
              disabled={Boolean(busyAction)}
              onClick={() => void onTransition(order, "cancel")}
              type="button"
            >
              {busyAction === `${order.id}:cancel` ? "Cancelling" : "Cancel"}
            </button>
            <button
              className="admin-link-button"
              disabled={Boolean(busyAction)}
              onClick={() => void onTransition(order, "expire")}
              type="button"
            >
              {busyAction === `${order.id}:expire` ? "Expiring" : "Expire"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MetricCard({
  label,
  meta,
  value,
}: {
  label: string;
  meta: string;
  value: number;
}) {
  return (
    <article className="admin-orders-kpi">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <small>{meta}</small>
    </article>
  );
}

function EmptyOrdersState({
  disabled,
  onReset,
}: {
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <div className="admin-orders-empty">
      <span aria-hidden="true">
        <Inbox size={28} />
      </span>
      <div>
        <h2>No orders found</h2>
        <p>Try adjusting your filters or search terms.</p>
      </div>
      <button
        className="button button--secondary"
        disabled={disabled}
        onClick={onReset}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={17} />
        Reset filters
      </button>
    </div>
  );
}

function AccessDeniedState({
  message,
  requestId,
}: {
  message?: string;
  requestId?: string;
}) {
  return (
    <div className="admin-orders-access" role="alert">
      <AlertCircle aria-hidden="true" size={20} />
      <div>
        <strong>Admin role required</strong>
        <p>{message || "This account is not allowed to access admin orders."}</p>
        {requestId ? <small>Request {requestId}</small> : null}
      </div>
    </div>
  );
}

function OrderListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="admin-orders-skeleton" role="status" aria-label="Loading orders">
      {Array.from({ length: rows }, (_, index) => (
        <div className="admin-orders-row admin-orders-row--skeleton" key={index}>
          {Array.from({ length: 8 }, (_, cellIndex) => (
            <span className="admin-skeleton-line" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function AdminFulfillmentStatusBadge({
  status,
}: {
  status: OrderFulfillmentStatus;
}) {
  return (
    <span
      className={`fulfillment-status-badge ${getFulfillmentStatusClass(status)}`}
    >
      {getFulfillmentStatusLabel(status)}
    </span>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
    </label>
  );
}

function DateFilter({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function getPageMetrics(orders: AdminOrderSummary[], total: number) {
  return {
    delivered: orders.filter(
      (order) => order.fulfillmentStatus === "DELIVERED",
    ).length,
    inProgress: orders.filter(
      (order) =>
        order.status === "PAID" && order.fulfillmentStatus !== "DELIVERED",
    ).length,
    paid: orders.filter((order) => order.status === "PAID").length,
    pending: orders.filter((order) => order.status === "PENDING_PAYMENT").length,
    total,
  };
}
