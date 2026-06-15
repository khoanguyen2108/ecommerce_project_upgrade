"use client";

import {
  AlertCircle,
  BarChart3,
  Boxes,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  Info,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Users,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  getAdminOrderStats,
  getAdminRevenue,
  getAdminStatsOverview,
  getAdminTopProducts,
} from "@/features/admin-stats/api";
import type {
  AdminOrderStats,
  AdminRevenue,
  AdminRevenueBucket,
  AdminRevenueGroupBy,
  AdminStatsOverview,
  AdminTopProduct,
} from "@/features/admin-stats/types";
import { formatPrice } from "@/features/catalog/format";
import type { OrderStatus } from "@/features/orders/types";
import {
  getApiErrorMessage,
  getApiRequestId,
} from "@/components/admin/admin-format";

const TOP_PRODUCTS_LIMIT = 10;
const DEFAULT_GROUP_BY: AdminRevenueGroupBy = "day";

const ORDER_STATUSES: {
  description: string;
  label: string;
  status: OrderStatus;
}[] = [
  {
    description: "Awaiting payment completion.",
    label: "Pending payment",
    status: "PENDING_PAYMENT",
  },
  {
    description: "Backend-confirmed paid orders.",
    label: "Paid",
    status: "PAID",
  },
  {
    description: "Orders cancelled before completion.",
    label: "Cancelled",
    status: "CANCELLED",
  },
  {
    description: "Orders whose payment window expired.",
    label: "Expired",
    status: "EXPIRED",
  },
];

const STATS_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some stats filters are invalid. Review the range and grouping.",
  FORBIDDEN: "This account is not allowed to view admin stats.",
  NETWORK_ERROR: "The stats API could not be reached. Check the backend and retry.",
  STATS_DATE_RANGE_INVALID: "The from date must be before or equal to the to date.",
  STATS_DATE_RANGE_TOO_LARGE:
    "This date range is too large for the selected revenue grouping.",
  VALIDATION_ERROR: "Some stats filters are invalid. Review the range and grouping.",
};

export interface AdminStatsInitialQuery {
  from?: string;
  groupBy?: AdminRevenueGroupBy;
  to?: string;
}

interface StatsFormState {
  from: string;
  groupBy: AdminRevenueGroupBy;
  to: string;
}

interface AdminStatsSnapshot {
  orders: AdminOrderStats;
  overview: AdminStatsOverview;
  revenue: AdminRevenue;
  topProductLimit: number;
  topProducts: AdminTopProduct[];
}

interface AdminStatsPageProps {
  initialQuery: AdminStatsInitialQuery;
}

export function AdminStatsPage({ initialQuery }: AdminStatsPageProps) {
  const initialFilters = getInitialFilters(initialQuery);
  const [form, setForm] = useState<StatsFormState>(initialFilters);
  const [query, setQuery] = useState<StatsFormState>(initialFilters);
  const [snapshot, setSnapshot] = useState<AdminStatsSnapshot>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      const dateQuery = getDateRangeQuery(query);

      try {
        const [overviewResponse, revenueResponse, topProductsResponse, orderResponse] =
          await Promise.all([
            getAdminStatsOverview(dateQuery),
            getAdminRevenue({
              ...dateQuery,
              groupBy: query.groupBy,
            }),
            getAdminTopProducts({
              ...dateQuery,
              limit: TOP_PRODUCTS_LIMIT,
            }),
            getAdminOrderStats(dateQuery),
          ]);

        if (!isMounted) {
          return;
        }

        setSnapshot({
          orders: orderResponse.orders,
          overview: overviewResponse.overview,
          revenue: revenueResponse.revenue,
          topProductLimit: topProductsResponse.limit,
          topProducts: topProductsResponse.topProducts,
        });
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setSnapshot(undefined);
        setError(
          getApiErrorMessage(
            loadError,
            STATS_ERROR_MESSAGES,
            "Admin stats could not be loaded right now.",
          ),
        );
        setRequestId(getApiRequestId(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, [query, refreshKey]);

  function handleFiltersSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setRequestId(undefined);

    const validationError = validateDateRange(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setQuery({
      from: form.from,
      groupBy: form.groupBy,
      to: form.to,
    });
  }

  function handleResetFilters() {
    const nextFilters: StatsFormState = {
      from: "",
      groupBy: DEFAULT_GROUP_BY,
      to: "",
    };

    setForm(nextFilters);
    setQuery(nextFilters);
  }

  const hasActiveFilters =
    Boolean(form.from) || Boolean(form.to) || form.groupBy !== DEFAULT_GROUP_BY;

  return (
    <div className="admin-resource admin-resource--wide admin-stats">
      <section className="admin-resource__header" aria-labelledby="admin-stats-heading">
        <div>
          <p className="eyebrow">Admin stats</p>
          <h1 id="admin-stats-heading">Stats</h1>
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

      <section className="admin-resource__toolbar" aria-label="Stats filters">
        <form
          className="admin-filter-grid admin-stats__filters"
          onSubmit={handleFiltersSubmit}
        >
          <label>
            <span>From</span>
            <input
              max="9999-12-31"
              onChange={(event) =>
                setForm((current) => ({ ...current, from: event.target.value }))
              }
              type="date"
              value={form.from}
            />
          </label>

          <label>
            <span>To</span>
            <input
              max="9999-12-31"
              onChange={(event) =>
                setForm((current) => ({ ...current, to: event.target.value }))
              }
              type="date"
              value={form.to}
            />
          </label>

          <label>
            <span>Group by</span>
            <select
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  groupBy: event.target.value as AdminRevenueGroupBy,
                }))
              }
              value={form.groupBy}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>

          <div className="admin-stats__filter-actions">
            <button className="button button--primary" disabled={isLoading} type="submit">
              <CalendarDays aria-hidden="true" size={17} />
              Apply
            </button>
            <button
              className="button button--secondary"
              disabled={isLoading || !hasActiveFilters}
              onClick={handleResetFilters}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={17} />
              Reset
            </button>
          </div>
        </form>

        <p className="admin-stats__filter-note">
          Revenue and top products are backend-confirmed paid data only.
        </p>
      </section>

      {error ? (
        <AdminFeedback message={error} requestId={requestId} tone="error" />
      ) : null}

      {isLoading && !snapshot ? <AdminStatsLoading /> : null}

      {!isLoading && error && !snapshot ? (
        <section className="admin-panel__empty admin-stats__state" role="alert">
          Stats could not be loaded. Check the backend connection and retry.
        </section>
      ) : null}

      {snapshot ? (
        <AdminStatsContent isRefreshing={isLoading} snapshot={snapshot} />
      ) : null}
    </div>
  );
}

function AdminStatsContent({
  isRefreshing,
  snapshot,
}: {
  isRefreshing: boolean;
  snapshot: AdminStatsSnapshot;
}) {
  const revenueIsEmpty =
    snapshot.revenue.totalRevenue === 0 && snapshot.revenue.paidOrdersCount === 0;
  const paidDataIsEmpty =
    snapshot.overview.paidOrdersCount === 0 &&
    revenueIsEmpty &&
    snapshot.topProducts.length === 0;

  return (
    <div className="admin-stats__content" aria-busy={isRefreshing}>
      {paidDataIsEmpty ? (
        <div className="admin-stats__empty-summary" role="status">
          <Info aria-hidden="true" size={19} />
          <span>
            No backend-confirmed paid revenue or paid product sales are available
            for this range yet.
          </span>
        </div>
      ) : null}

      <OverviewMetrics overview={snapshot.overview} />

      {snapshot.revenue.totalRevenue === 0 ? (
        <div className="admin-stats__paid-note" role="note">
          <Info aria-hidden="true" size={19} />
          <span>Revenue appears after backend-confirmed paid payments.</span>
        </div>
      ) : null}

      <RevenueSection revenue={snapshot.revenue} />

      <div className="admin-stats__columns">
        <TopProductsSection
          limit={snapshot.topProductLimit}
          topProducts={snapshot.topProducts}
        />
        <OrderStatusSection orders={snapshot.orders} />
      </div>
    </div>
  );
}

function OverviewMetrics({ overview }: { overview: AdminStatsOverview }) {
  const metrics = [
    {
      helper: "Backend-confirmed paid revenue only.",
      icon: CircleDollarSign,
      label: "Backend-confirmed paid revenue",
      value: formatPrice(overview.totalRevenue),
    },
    {
      helper: "Orders with paid order state.",
      icon: ShoppingBag,
      label: "Paid orders",
      value: formatNumber(overview.paidOrdersCount),
    },
    {
      helper: "Orders awaiting payment.",
      icon: CalendarDays,
      label: "Pending payment orders",
      value: formatNumber(overview.pendingOrdersCount),
    },
    {
      helper: "Orders cancelled before completion.",
      icon: AlertCircle,
      label: "Cancelled orders",
      value: formatNumber(overview.cancelledOrdersCount),
    },
    {
      helper: "Orders whose payment window expired.",
      icon: BarChart3,
      label: "Expired orders",
      value: formatNumber(overview.expiredOrdersCount),
    },
    {
      helper: "Paid revenue divided by paid orders.",
      icon: ChartNoAxesColumnIncreasing,
      label: "Average backend-confirmed paid order value",
      value: formatPrice(overview.averagePaidOrderValue),
    },
    {
      helper: "Customer accounts in the backend.",
      icon: Users,
      label: "Customers",
      value: formatNumber(overview.totalCustomers),
    },
    {
      helper: "Products recorded in the catalog.",
      icon: Package,
      label: "Products",
      value: formatNumber(overview.totalProducts),
    },
    {
      helper: "Active variants at or below the backend threshold.",
      icon: Boxes,
      label: "Low-stock variants",
      value: formatNumber(overview.lowStockVariantsCount),
    },
  ];

  return (
    <section className="admin-stats__metrics" aria-label="Overview metrics">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article className="admin-stat-card" key={metric.label}>
            <span className="admin-stat-card__icon">
              <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
            </span>
            <span className="admin-stat-card__copy">
              <span className="admin-stat-card__label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </span>
          </article>
        );
      })}
    </section>
  );
}

function RevenueSection({ revenue }: { revenue: AdminRevenue }) {
  const revenueIsEmpty = revenue.totalRevenue === 0 && revenue.paidOrdersCount === 0;

  return (
    <section className="admin-stats__section" aria-labelledby="admin-revenue-heading">
      <div className="admin-stats__section-header">
        <div>
          <p className="eyebrow">Paid revenue</p>
          <h2 id="admin-revenue-heading">Backend-confirmed paid revenue</h2>
        </div>
        <span className="admin-stats__section-meta">
          Grouped by {formatGroupBy(revenue.groupBy)}
        </span>
      </div>

      <div className="admin-stats__totals" aria-label="Revenue totals">
        <span>
          <small>Total</small>
          <strong>{formatPrice(revenue.totalRevenue)}</strong>
        </span>
        <span>
          <small>Paid orders</small>
          <strong>{formatNumber(revenue.paidOrdersCount)}</strong>
        </span>
      </div>

      {revenueIsEmpty ? (
        <div className="admin-panel__empty admin-stats__state" role="status">
          No backend-confirmed paid revenue exists for this range.
        </div>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table admin-table--stats">
          <thead>
            <tr>
              <th>Period</th>
              <th>Backend-confirmed paid revenue</th>
              <th>Paid orders</th>
            </tr>
          </thead>
          <tbody>
            {revenue.buckets.length === 0 ? (
              <tr>
                <td className="admin-table__state" colSpan={3}>
                  No revenue buckets are available for the current range.
                </td>
              </tr>
            ) : (
              revenue.buckets.map((bucket) => (
                <tr key={bucket.periodStart}>
                  <td>{formatPeriod(bucket, revenue.groupBy)}</td>
                  <td>{formatPrice(bucket.revenue)}</td>
                  <td>{formatNumber(bucket.paidOrdersCount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TopProductsSection({
  limit,
  topProducts,
}: {
  limit: number;
  topProducts: AdminTopProduct[];
}) {
  return (
    <section className="admin-stats__section" aria-labelledby="top-products-heading">
      <div className="admin-stats__section-header">
        <div>
          <p className="eyebrow">Paid products</p>
          <h2 id="top-products-heading">Top products</h2>
        </div>
        <span className="admin-stats__section-meta">Limit {limit}</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table--stats">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity sold</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.length === 0 ? (
              <tr>
                <td className="admin-table__state" colSpan={3}>
                  No products have backend-confirmed paid sales for this range.
                </td>
              </tr>
            ) : (
              topProducts.map((product) => (
                <tr key={`${product.productId}:${product.variantId}`}>
                  <td>
                    <strong>{product.productName}</strong>
                  </td>
                  <td>{formatNumber(product.quantitySold)}</td>
                  <td>{formatPrice(product.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderStatusSection({ orders }: { orders: AdminOrderStats }) {
  return (
    <section className="admin-stats__section" aria-labelledby="order-status-heading">
      <div className="admin-stats__section-header">
        <div>
          <p className="eyebrow">Orders</p>
          <h2 id="order-status-heading">Order status</h2>
        </div>
        <span className="admin-stats__section-meta">
          Total {formatNumber(orders.total)}
        </span>
      </div>

      <div className="admin-status-grid" aria-label="Order status cards">
        {ORDER_STATUSES.map((item) => (
          <article
            className={`admin-status-card admin-status-card--${item.status.toLowerCase().replace("_", "-")}`}
            key={item.status}
          >
            <small>{item.label}</small>
            <strong>{formatNumber(orders.byStatus[item.status] ?? 0)}</strong>
            <span>{item.description}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminStatsLoading() {
  return (
    <div className="admin-stats__content" role="status">
      <section className="admin-stats__metrics" aria-label="Loading overview metrics">
        {Array.from({ length: 9 }, (_, index) => (
          <article aria-hidden="true" className="admin-stat-card" key={index}>
            <span className="admin-stat-card__icon admin-stat-card__icon--loading" />
            <span className="admin-stat-card__copy">
              <span className="admin-skeleton-line" />
              <span className="admin-skeleton-line admin-skeleton-line--wide" />
              <span className="admin-skeleton-line" />
            </span>
          </article>
        ))}
      </section>

      <section className="admin-stats__section" aria-label="Loading revenue">
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--stats">
            <tbody>
              <AdminTableSkeleton columns={3} rows={4} />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminFeedback({
  message,
  requestId,
  tone,
}: {
  message: string;
  requestId?: string;
  tone: "error";
}) {
  return (
    <div className={`admin-feedback admin-feedback--${tone}`} role="alert">
      <AlertCircle aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>Request {requestId}</small> : null}
    </div>
  );
}

function AdminTableSkeleton({
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
          <span className="admin-skeleton-line" />
        </td>
      ))}
    </tr>
  ));
}

function getInitialFilters(initialQuery: AdminStatsInitialQuery): StatsFormState {
  return {
    from: initialQuery.from || "",
    groupBy: initialQuery.groupBy || DEFAULT_GROUP_BY,
    to: initialQuery.to || "",
  };
}

function getDateRangeQuery(query: StatsFormState) {
  return {
    from: query.from || undefined,
    to: query.to || undefined,
  };
}

function validateDateRange(query: StatsFormState): string | undefined {
  if (query.from && query.to && query.from > query.to) {
    return "The from date must be before or equal to the to date.";
  }

  return undefined;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatGroupBy(groupBy: AdminRevenueGroupBy): string {
  if (groupBy === "day") {
    return "day";
  }

  if (groupBy === "week") {
    return "week";
  }

  return "month";
}

function formatPeriod(
  bucket: AdminRevenueBucket,
  groupBy: AdminRevenueGroupBy,
): string {
  if (groupBy === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }).format(new Date(bucket.periodStart));
  }

  if (groupBy === "week") {
    return `${formatDateOnly(bucket.periodStart)} - ${formatDateOnly(
      bucket.periodEnd,
    )}`;
  }

  return formatDateOnly(bucket.periodStart);
}

function formatDateOnly(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}
