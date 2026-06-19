"use client";

import { Eye, RefreshCw, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AdminFeedback,
  AdminOrderStatusBadge,
  AdminPagination,
  AdminPaymentSafetyNote,
  AdminPaymentStatusBadge,
  AdminTableSkeleton,
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
import type { OrderStatus } from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";
import {
  formatCurrency,
  formatDateTime,
} from "@/components/orders/order-format";

const LIMIT = 20;
const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CANCELLED",
  "EXPIRED",
];

export function AdminOrdersPage({ initialQuery }: { initialQuery: AdminOrderQuery }) {
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
  const [requestId, setRequestId] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response = await listAdminOrders(query);
        if (active) {
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

  async function transition(order: AdminOrderSummary, action: "cancel" | "expire") {
    if (order.status !== "PENDING_PAYMENT") return;

    const verb = action === "cancel" ? "cancel" : "expire";
    const confirmed = window.confirm(
      `Confirm ${verb} for order ${order.id}? This changes only the local pending order/payment state and does not call payOS.`,
    );
    if (!confirmed) return;

    setBusyAction(`${order.id}:${action}`);
    setError(undefined);
    setSuccess(undefined);
    setRequestId(undefined);

    try {
      if (action === "cancel") await cancelAdminOrder(order.id);
      else await expireAdminOrder(order.id);
      setSuccess(`Order ${order.id} was ${action === "cancel" ? "cancelled" : "expired"}.`);
      setRefreshKey((current) => current + 1);
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

  const hasFilters = Boolean(
    query.status || query.search || query.from || query.to ||
      query.sort !== "createdAt" || query.order !== "desc",
  );

  return (
    <div className="admin-resource admin-resource--full-width">
      <section className="admin-resource__header" aria-labelledby="admin-orders-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">Commerce operations</p>
          <h1 id="admin-orders-heading">Orders Management</h1>
          <p>Review order, customer, payment, and fulfillment state.</p>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={isLoading ? "spin" : undefined} size={17} />
          Refresh
        </button>
      </section>

      <AdminPaymentSafetyNote includeTransition />

      <section className="admin-resource__toolbar" aria-label="Order filters">
        <form className="admin-search" onSubmit={submitSearch}>
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
              <Search aria-hidden="true" size={17} /> Search
            </button>
          </div>
        </form>

        <div className="admin-filter-grid admin-filter-grid--commerce">
          <FilterSelect label="Status" value={query.status || ""} onChange={(value) => updateQuery({ status: (value || undefined) as OrderStatus | undefined })}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </FilterSelect>
          <DateFilter label="From" value={query.from || ""} onChange={(value) => updateQuery({ from: value || undefined })} />
          <DateFilter label="To" value={query.to || ""} onChange={(value) => updateQuery({ to: value || undefined })} />
          <FilterSelect label="Sort" value={query.sort || "createdAt"} onChange={(value) => updateQuery({ sort: value as AdminOrderSort })}>
            <option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="totalAmount">Total</option><option value="paidAt">Paid time</option>
          </FilterSelect>
          <FilterSelect label="Order" value={query.order || "desc"} onChange={(value) => updateQuery({ order: value as AdminOrderSortDirection })}>
            <option value="desc">Descending</option><option value="asc">Ascending</option>
          </FilterSelect>
          <button className="button button--secondary" disabled={!hasFilters || isLoading} onClick={resetFilters} type="button">
            <RotateCcw aria-hidden="true" size={17} /> Reset
          </button>
        </div>
      </section>

      {success ? <AdminFeedback message={success} tone="success" /> : null}
      {error ? <AdminFeedback message={error} requestId={requestId} tone="error" /> : null}

      <div className="admin-table-wrap admin-table-wrap--commerce">
        <table className="admin-table admin-table--commerce">
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Items</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {isLoading ? <AdminTableSkeleton columns={8} rows={6} /> : null}
            {!isLoading && !error && orders.length === 0 ? <tr><td className="admin-table__state" colSpan={8}>No orders match the current filters.</td></tr> : null}
            {!isLoading && !error ? orders.map((order) => (
              <tr key={order.id}>
                <td><span className="admin-code">{order.id}</span></td>
                <td><strong>{order.user.email}</strong><small className="admin-table__secondary">{order.user.name || "Name not set"}</small></td>
                <td><AdminOrderStatusBadge status={order.status} /></td>
                <td>{order.latestPayment ? <AdminPaymentStatusBadge status={order.latestPayment.status} /> : <span className="admin-table__muted">Not set</span>}</td>
                <td>{formatCurrency(order.totalAmount, order.currency)}</td>
                <td>{order.itemCount}</td>
                <td>{formatDateTime(order.createdAt)}</td>
                <td><div className="admin-row-actions admin-row-actions--commerce">
                  <Link aria-label={`View order ${order.id}`} className="icon-button admin-icon-button" href={`/admin/orders/${encodeURIComponent(order.id)}`} title="View order"><Eye aria-hidden="true" size={17} /></Link>
                  {order.status === "PENDING_PAYMENT" ? <>
                    <button className="admin-link-button" disabled={Boolean(busyAction)} onClick={() => void transition(order, "cancel")} type="button">Cancel</button>
                    <button className="admin-link-button" disabled={Boolean(busyAction)} onClick={() => void transition(order, "expire")} type="button">Expire</button>
                  </> : null}
                </div></td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>

      <AdminPagination isLoading={isLoading} noun="orders" onPageChange={(page) => setQuery((current) => ({ ...current, page }))} pagination={pagination} />
    </div>
  );
}

function FilterSelect({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return <label><span>{label}</span><select onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label>;
}

function DateFilter({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <label><span>{label}</span><input aria-label={label} onChange={(event) => onChange(event.target.value)} type="date" value={value} /></label>;
}
