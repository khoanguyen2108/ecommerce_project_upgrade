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
import {
  getAdminOperationsTranslations,
  type AdminOperationsTranslations,
} from "@/features/i18n/admin-operations-translations";
import type { Locale } from "@/features/i18n/locale";
import { useI18n } from "@/features/i18n/useI18n";

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
  "RETURNED",
];

type OrderAction = "cancel" | "expire";
type OrderErrorFallback = "load" | OrderAction;

interface OrderUiError {
  cause: unknown;
  fallback: OrderErrorFallback;
}

interface OrderSuccess {
  action: OrderAction;
  orderId: string;
}

export function AdminOrdersPage({
  initialQuery,
}: {
  initialQuery: AdminOrderQuery;
}) {
  const { locale } = useI18n();
  const copy = getAdminOperationsTranslations(locale);
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
  const [error, setError] = useState<OrderUiError>();
  const [errorCode, setErrorCode] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [success, setSuccess] = useState<OrderSuccess>();
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
          setError({ cause: loadError, fallback: "load" });
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
    action: OrderAction,
  ) {
    if (order.status !== "PENDING_PAYMENT") return;

    const confirmed = window.confirm(
      copy.orders.list.confirmTransition(action, order.orderCode || order.id),
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
      setSuccess({
        action,
        orderId: formatOrderDisplayId(order.orderCode || order.id),
      });
      setRefreshKey((current) => current + 1);
    } catch (actionError) {
      setError({ cause: actionError, fallback: action });
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
  const errorMessage = error
    ? getAdminOrderErrorMessage(
        error.cause,
        error.fallback === "load"
          ? copy.orders.list.loadError
          : copy.orders.list.transitionError(error.fallback),
        locale,
      )
    : undefined;
  const successMessage = success
    ? copy.orders.list.transitionSuccess(success.orderId, success.action)
    : undefined;

  return (
    <div className="admin-resource admin-resource--full-width admin-orders-management">
      <section className="admin-orders-hero" aria-labelledby="admin-orders-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">{copy.orders.list.eyebrow}</p>
          <h1 id="admin-orders-heading">{copy.orders.list.title}</h1>
          <p>{copy.orders.list.subtitle}</p>
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
          {copy.common.refresh}
        </button>
      </section>

      <section className="admin-orders-kpis" aria-label={copy.orders.list.summaryAria}>
        <MetricCard
          label={copy.orders.list.metricTotal}
          locale={locale}
          meta={copy.orders.list.matchingFilters}
          value={metrics.total}
        />
        <MetricCard
          label={copy.orders.list.metricPaid}
          locale={locale}
          meta={copy.orders.list.currentPage}
          value={metrics.paid}
        />
        <MetricCard
          label={copy.orders.list.metricPending}
          locale={locale}
          meta={copy.orders.list.currentPage}
          value={metrics.pending}
        />
        <MetricCard
          label={copy.orders.list.metricNeedsFulfillment}
          locale={locale}
          meta={copy.orders.list.currentPage}
          value={metrics.inProgress}
        />
        <MetricCard
          label={copy.orders.list.metricDelivered}
          locale={locale}
          meta={copy.orders.list.currentPage}
          value={metrics.delivered}
        />
      </section>

      <section
        className="admin-orders-filter-panel admin-filter-surface"
        aria-label={copy.orders.list.filtersAria}
      >
        <form className="admin-orders-search" onSubmit={submitSearch}>
          <label htmlFor="admin-order-search">{copy.orders.list.search}</label>
          <div>
            <input
              id="admin-order-search"
              maxLength={160}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={copy.orders.list.searchPlaceholder}
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              {copy.orders.list.search}
            </button>
          </div>
        </form>

        <div className="admin-orders-filters">
          <FilterSelect
            label={copy.common.status}
            onChange={(value) =>
              updateQuery({
                status: (value || undefined) as OrderStatus | undefined,
              })
            }
            value={query.status || ""}
          >
            <option value="">{copy.orders.list.allStatuses}</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status, locale)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label={copy.orders.list.fulfillment}
            onChange={(value) =>
              updateQuery({
                fulfillmentStatus: (value || undefined) as
                  | OrderFulfillmentStatus
                  | undefined,
              })
            }
            value={query.fulfillmentStatus || ""}
          >
            <option value="">{copy.orders.list.allFulfillment}</option>
            {FULFILLMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getFulfillmentStatusLabel(status, locale)}
              </option>
            ))}
          </FilterSelect>
          <DateFilter
            label={copy.orders.list.dateFrom}
            onChange={(value) => updateQuery({ from: value || undefined })}
            value={query.from || ""}
          />
          <DateFilter
            label={copy.orders.list.dateTo}
            onChange={(value) => updateQuery({ to: value || undefined })}
            value={query.to || ""}
          />
          <FilterSelect
            label={copy.orders.list.sortField}
            onChange={(value) => updateQuery({ sort: value as AdminOrderSort })}
            value={query.sort || "createdAt"}
          >
            <option value="createdAt">{copy.orders.list.sortCreated}</option>
            <option value="updatedAt">{copy.orders.list.sortUpdated}</option>
            <option value="totalAmount">{copy.orders.list.sortTotal}</option>
            <option value="paidAt">{copy.orders.list.paidTime}</option>
          </FilterSelect>
          <FilterSelect
            label={copy.orders.list.sortOrder}
            onChange={(value) =>
              updateQuery({ order: value as AdminOrderSortDirection })
            }
            value={query.order || "desc"}
          >
            <option value="desc">{copy.orders.list.descending}</option>
            <option value="asc">{copy.orders.list.sortAscending}</option>
          </FilterSelect>
          <button
            className="button button--secondary"
            disabled={!hasFilters || isLoading}
            onClick={resetFilters}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            {copy.orders.list.reset}
          </button>
        </div>
      </section>

      {successMessage ? <AdminFeedback message={successMessage} tone="success" /> : null}
      {isAccessDenied ? (
        <AccessDeniedState
          copy={copy}
          message={errorMessage}
          requestId={requestId}
        />
      ) : errorMessage ? (
        <AdminFeedback message={errorMessage} requestId={requestId} tone="error" />
      ) : null}

      <section className="admin-orders-list" aria-label={copy.orders.list.columnsAria}>
        <div className="admin-orders-list__head" aria-hidden="true">
          <span>{copy.common.order}</span>
          <span>{copy.common.customer}</span>
          <span>{copy.common.fulfillment}</span>
          <span>{copy.common.payment}</span>
          <span>{copy.common.total}</span>
          <span>{copy.common.items}</span>
          <span>{copy.common.created}</span>
          <span>{copy.common.actions}</span>
        </div>

        {isLoading ? (
          <OrderListSkeleton label={copy.orders.list.loadingAria} rows={6} />
        ) : null}

        {!isLoading && !error && orders.length === 0 ? (
          <EmptyOrdersState
            copy={copy.orders.list}
            disabled={!hasFilters}
            onReset={resetFilters}
          />
        ) : null}

        {!isLoading && !error
          ? orders.map((order) => (
              <OrderRow
                busyAction={busyAction}
                copy={copy}
                key={order.id}
                locale={locale}
                onTransition={transition}
                order={order}
              />
            ))
          : null}
      </section>

      <AdminPagination
        isLoading={isLoading}
        noun={copy.orders.list.noun}
        onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
        pagination={pagination}
      />
    </div>
  );
}

function OrderRow({
  busyAction,
  copy,
  locale,
  onTransition,
  order,
}: {
  busyAction?: string;
  copy: AdminOperationsTranslations;
  locale: Locale;
  onTransition: (
    order: AdminOrderSummary,
    action: OrderAction,
  ) => Promise<void>;
  order: AdminOrderSummary;
}) {
  const customerLabel =
    order.customerName ||
    order.customerEmail ||
    order.shippingRecipientName ||
    copy.common.notSet;
  const customerMeta = [
    order.customerEmail,
    order.customerPhone,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="admin-orders-row">
      <div className="admin-orders-cell admin-orders-cell--order">
        <span className="admin-orders-mobile-label">{copy.common.order}</span>
        <strong>{formatOrderDisplayId(order.orderCode || order.id)}</strong>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">{copy.common.customer}</span>
        <strong>{customerLabel}</strong>
        <small>{customerMeta || copy.orders.list.customerDetailsUnavailable}</small>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">{copy.common.fulfillment}</span>
        <AdminFulfillmentStatusBadge locale={locale} status={order.fulfillmentStatus} />
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">{copy.common.payment}</span>
        {order.latestPayment ? (
          <>
            <AdminPaymentStatusBadge status={order.latestPayment.status} />
            <small>payOS {order.latestPayment.providerOrderCode}</small>
          </>
        ) : (
          <span className="admin-table__muted">{copy.common.notSet}</span>
        )}
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">{copy.common.total}</span>
        <strong>{formatCurrency(order.totalAmount, order.currency, locale)}</strong>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">{copy.common.items}</span>
        <span>{formatNumber(order.itemCount, locale)}</span>
      </div>
      <div className="admin-orders-cell">
        <span className="admin-orders-mobile-label">{copy.common.created}</span>
        <time dateTime={order.createdAt}>{formatDateTime(order.createdAt, locale)}</time>
      </div>
      <div className="admin-orders-actions">
        <Link
          aria-label={copy.orders.list.viewOrderAria(order.id)}
          className="button button--secondary admin-orders-view"
          href={`/admin/orders/${encodeURIComponent(order.id)}`}
        >
          <Eye aria-hidden="true" size={17} />
          {copy.orders.list.viewDetails}
        </Link>
        {order.status === "PENDING_PAYMENT" ? (
          <div className="admin-orders-inline-actions">
            <button
              className="admin-link-button"
              disabled={Boolean(busyAction)}
              onClick={() => void onTransition(order, "cancel")}
              type="button"
            >
              {busyAction === `${order.id}:cancel`
                ? copy.orders.list.cancelling
                : copy.orders.list.cancelOrder}
            </button>
            <button
              className="admin-link-button"
              disabled={Boolean(busyAction)}
              onClick={() => void onTransition(order, "expire")}
              type="button"
            >
              {busyAction === `${order.id}:expire`
                ? copy.orders.list.expiring
                : copy.orders.list.expireOrder}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MetricCard({
  label,
  locale,
  meta,
  value,
}: {
  label: string;
  locale: Locale;
  meta: string;
  value: number;
}) {
  return (
    <article className="admin-orders-kpi">
      <span>{label}</span>
      <strong>{formatNumber(value, locale)}</strong>
      <small>{meta}</small>
    </article>
  );
}

function EmptyOrdersState({
  copy,
  disabled,
  onReset,
}: {
  copy: AdminOperationsTranslations["orders"]["list"];
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <div className="admin-orders-empty">
      <span aria-hidden="true">
        <Inbox size={28} />
      </span>
      <div>
        <h2>{copy.emptyTitle}</h2>
        <p>{copy.emptyBody}</p>
      </div>
      <button
        className="button button--secondary"
        disabled={disabled}
        onClick={onReset}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={17} />
        {copy.resetFilters}
      </button>
    </div>
  );
}

function AccessDeniedState({
  copy,
  message,
  requestId,
}: {
  copy: AdminOperationsTranslations;
  message?: string;
  requestId?: string;
}) {
  return (
    <div className="admin-orders-access" role="alert">
      <AlertCircle aria-hidden="true" size={20} />
      <div>
        <strong>{copy.orders.list.accessDeniedTitle}</strong>
        <p>{message || copy.orders.list.accessDeniedFallback}</p>
        {requestId ? (
          <small>
            {copy.common.request} {requestId}
          </small>
        ) : null}
      </div>
    </div>
  );
}

function OrderListSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div className="admin-orders-skeleton" role="status" aria-label={label}>
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
  locale,
  status,
}: {
  locale: Locale;
  status: OrderFulfillmentStatus;
}) {
  return (
    <span
      className={`fulfillment-status-badge ${getFulfillmentStatusClass(status)}`}
    >
      {getFulfillmentStatusLabel(status, locale)}
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
        order.status === "PAID" &&
        order.fulfillmentStatus !== "DELIVERED" &&
        order.fulfillmentStatus !== "RETURNED",
    ).length,
    paid: orders.filter((order) => order.status === "PAID").length,
    pending: orders.filter((order) => order.status === "PENDING_PAYMENT").length,
    total,
  };
}
