"use client";

import {
  AlertTriangle,
  CircleDollarSign,
  ClipboardList,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AdminDashboardFilters,
  getDefaultDashboardDateRange,
  type DashboardDateRange,
} from "@/components/admin-dashboard/AdminDashboardFilters";
import { AdminMetricCard } from "@/components/admin-dashboard/AdminMetricCard";
import { MonthlySalesChart } from "@/components/admin-dashboard/MonthlySalesChart";
import { TopProductsCard } from "@/components/admin-dashboard/TopProductsCard";
import {
  getAdminOrderStats,
  getAdminRevenue,
  getAdminStatsOverview,
  getAdminTopProducts,
} from "@/features/admin-stats/api";
import { getAdminStatsError } from "@/features/admin-stats/errors";
import type {
  AdminOrderStats,
  AdminRevenue,
  AdminStatsOverview,
  AdminTopProduct,
} from "@/features/admin-stats/types";
import {
  formatCurrency,
  formatNumber,
} from "@/components/orders/order-format";
import { useAdminCommonI18n } from "@/features/i18n/admin-common-translations";
import type { Locale } from "@/features/i18n/locale";

interface DashboardSnapshot {
  orders?: AdminOrderStats;
  overview?: AdminStatsOverview;
  revenue?: AdminRevenue;
  topProducts?: AdminTopProduct[];
}

export function AdminDashboardPage() {
  const [range, setRange] = useState<DashboardDateRange>(
    getDefaultDashboardDateRange,
  );
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<unknown[]>([]);
  const [requestIds, setRequestIds] = useState<string[]>([]);
  const [isTopProductsUnavailable, setIsTopProductsUnavailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { locale, messages } = useAdminCommonI18n();

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setErrors([]);
      setRequestIds([]);
      setIsTopProductsUnavailable(false);

      const dateQuery = { from: range.from, to: range.to };
      const results = await Promise.allSettled([
        getAdminStatsOverview(dateQuery),
        getAdminOrderStats(dateQuery),
        getAdminRevenue({ ...dateQuery, groupBy: "month" }),
        getAdminTopProducts({ ...dateQuery, limit: 5 }),
      ]);

      if (!isMounted) {
        return;
      }

      const [overviewResult, ordersResult, revenueResult, topProductsResult] = results;
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);

      setSnapshot({
        orders:
          ordersResult.status === "fulfilled" ? ordersResult.value.orders : undefined,
        overview:
          overviewResult.status === "fulfilled"
            ? overviewResult.value.overview
            : undefined,
        revenue:
          revenueResult.status === "fulfilled"
            ? revenueResult.value.revenue
            : undefined,
        topProducts:
          topProductsResult.status === "fulfilled"
            ? topProductsResult.value.topProducts
            : undefined,
      });
      setIsTopProductsUnavailable(topProductsResult.status === "rejected");
      setErrors(failures);
      setRequestIds([
        ...new Set(
          failures
            .map((failure) => getAdminStatsError(failure, "en").requestId)
            .filter((requestId): requestId is string => Boolean(requestId)),
        ),
      ]);
      setIsLoading(false);
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [range, refreshKey]);

  const filterLabel = formatRangeLabel(range, locale);
  const localizedErrors = [
    ...new Set(errors.map((error) => getAdminStatsError(error, locale).message)),
  ];
  const hasAnyData = Boolean(
    snapshot.overview || snapshot.orders || snapshot.revenue,
  );

  return (
    <div className="admin-dashboard-modern">
      <section className="admin-dashboard-modern__heading" aria-labelledby="dashboard-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">
            {messages.dashboard.storeOperations}
          </p>
          <h1 id="dashboard-heading">{messages.dashboard.title}</h1>
          <p>{messages.dashboard.subtitle}</p>
        </div>
        <AdminDashboardFilters
          isLoading={isLoading}
          onApply={setRange}
          onRefresh={() => setRefreshKey((current) => current + 1)}
          value={range}
        />
      </section>

      {localizedErrors.length > 0 ? (
        <div className="admin-dashboard-alert" role="alert">
          <AlertTriangle aria-hidden="true" size={20} />
          <div>
            <strong>
              {hasAnyData
                ? messages.dashboard.partialUnavailable
                : messages.dashboard.dataUnavailable}
            </strong>
            {localizedErrors.map((error) => (
              <span key={error}>{error}</span>
            ))}
            {requestIds.length > 0 ? (
              <small>{messages.common.request}: {requestIds.join(", ")}</small>
            ) : null}
          </div>
          <button
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            {messages.common.retry}
          </button>
        </div>
      ) : null}

      <section
        aria-label={messages.dashboard.kpiLabel}
        className="admin-dashboard-metrics"
      >
        <AdminMetricCard
          detail={messages.dashboard.verifiedRevenueOnly}
          icon={CircleDollarSign}
          isLoading={isLoading && !snapshot.overview}
          label={messages.dashboard.totalRevenue}
          value={
            snapshot.overview
              ? formatCurrency(snapshot.overview.totalRevenue, "VND", locale)
              : undefined
          }
        />
        <AdminMetricCard
          detail={filterLabel}
          icon={ShoppingBag}
          isLoading={isLoading && !snapshot.orders}
          label={messages.dashboard.paidOrders}
          value={
            snapshot.orders
              ? formatNumber(snapshot.orders.byStatus.PAID, locale)
              : undefined
          }
        />
        <AdminMetricCard
          detail={messages.dashboard.averageOrderDescription}
          icon={ClipboardList}
          isLoading={isLoading && !snapshot.overview}
          label={messages.dashboard.averageOrderValue}
          value={
            snapshot.overview
              ? formatCurrency(
                  snapshot.overview.averagePaidOrderValue,
                  "VND",
                  locale,
                )
              : undefined
          }
        />
        <AdminMetricCard
          detail={messages.dashboard.allCustomers}
          icon={Users}
          isLoading={isLoading && !snapshot.overview}
          label={messages.dashboard.customers}
          value={
            snapshot.overview
              ? formatNumber(snapshot.overview.totalCustomers, locale)
              : undefined
          }
        />
      </section>

      <section
        className="admin-dashboard-primary-grid"
        aria-label={messages.dashboard.operationalOverview}
      >
        <MonthlySalesChart
          buckets={snapshot.revenue?.buckets}
          isLoading={isLoading}
        />
        <OperationsOverview
          isLoading={isLoading}
          orders={snapshot.orders}
          overview={snapshot.overview}
        />
      </section>

      <TopProductsCard
        isLoading={isLoading && !snapshot.topProducts}
        isUnavailable={isTopProductsUnavailable}
        onRetry={() => setRefreshKey((current) => current + 1)}
        products={snapshot.topProducts}
      />
    </div>
  );
}

function OperationsOverview({
  isLoading,
  orders,
  overview,
}: {
  isLoading: boolean;
  orders?: AdminOrderStats;
  overview?: AdminStatsOverview;
}) {
  const { locale, messages } = useAdminCommonI18n();
  const rows = [
    [messages.dashboard.pendingPayment, orders?.byStatus.PENDING_PAYMENT],
    [messages.dashboard.paid, orders?.byStatus.PAID],
    [messages.dashboard.cancelled, orders?.byStatus.CANCELLED],
    [messages.dashboard.expired, orders?.byStatus.EXPIRED],
  ] as const;

  return (
    <article className="admin-dashboard-card admin-dashboard-card--operations">
      <header className="admin-dashboard-card__header">
        <div>
          <p className="admin-dashboard-card__kicker">
            {messages.dashboard.operations}
          </p>
          <h2>{messages.dashboard.storeStatus}</h2>
          <span>{messages.dashboard.currentTotals}</span>
        </div>
      </header>

      <div className="admin-dashboard-operations-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            {isLoading && value === undefined ? (
              <span className="admin-dashboard-skeleton admin-dashboard-skeleton--compact" />
            ) : (
              <strong>
                {value === undefined
                  ? messages.common.unavailable
                  : formatNumber(value, locale)}
              </strong>
            )}
          </div>
        ))}
      </div>

      <div className="admin-dashboard-inventory-summary">
        <span>
          <small>{messages.dashboard.totalProducts}</small>
          <strong>
            {overview
              ? formatNumber(overview.totalProducts, locale)
              : messages.common.unavailable}
          </strong>
        </span>
        <span>
          <small>{messages.dashboard.lowStockVariants}</small>
          <strong>
            {overview
              ? formatNumber(overview.lowStockVariantsCount, locale)
              : messages.common.unavailable}
          </strong>
        </span>
      </div>
    </article>
  );
}

function formatRangeLabel(range: DashboardDateRange, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${range.from}T00:00:00Z`))} – ${formatter.format(
    new Date(`${range.to}T00:00:00Z`),
  )}`;
}
