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
import { formatPrice } from "@/features/catalog/format";

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
  const [errors, setErrors] = useState<string[]>([]);
  const [requestIds, setRequestIds] = useState<string[]>([]);
  const [isTopProductsUnavailable, setIsTopProductsUnavailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
        .map((result) => getAdminStatsError(result.reason));

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
      setErrors([...new Set(failures.map((failure) => failure.message))]);
      setRequestIds([
        ...new Set(
          failures
            .map((failure) => failure.requestId)
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

  const filterLabel = formatRangeLabel(range);
  const hasAnyData = Boolean(
    snapshot.overview || snapshot.orders || snapshot.revenue,
  );

  return (
    <div className="admin-dashboard-modern">
      <section className="admin-dashboard-modern__heading" aria-labelledby="dashboard-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">Store operations</p>
          <h1 id="dashboard-heading">Dashboard Overview</h1>
          <p>Live catalog, customer, order, and verified revenue signals.</p>
        </div>
        <AdminDashboardFilters
          isLoading={isLoading}
          onApply={setRange}
          onRefresh={() => setRefreshKey((current) => current + 1)}
          value={range}
        />
      </section>

      {errors.length > 0 ? (
        <div className="admin-dashboard-alert" role="alert">
          <AlertTriangle aria-hidden="true" size={20} />
          <div>
            <strong>
              {hasAnyData
                ? "Some dashboard data is temporarily unavailable."
                : "Dashboard data could not be loaded."}
            </strong>
            {errors.map((error) => (
              <span key={error}>{error}</span>
            ))}
            {requestIds.length > 0 ? (
              <small>Request ID: {requestIds.join(", ")}</small>
            ) : null}
          </div>
          <button
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section aria-label="Key performance indicators" className="admin-dashboard-metrics">
        <AdminMetricCard
          detail="Verified paid revenue only"
          icon={CircleDollarSign}
          isLoading={isLoading && !snapshot.overview}
          label="Total revenue"
          value={
            snapshot.overview
              ? formatPrice(snapshot.overview.totalRevenue)
              : undefined
          }
        />
        <AdminMetricCard
          detail={filterLabel}
          icon={ShoppingBag}
          isLoading={isLoading && !snapshot.orders}
          label="Paid orders"
          value={snapshot.orders?.byStatus.PAID.toLocaleString("en")}
        />
        <AdminMetricCard
          detail="Across verified paid orders"
          icon={ClipboardList}
          isLoading={isLoading && !snapshot.overview}
          label="Average order value"
          value={
            snapshot.overview
              ? formatPrice(snapshot.overview.averagePaidOrderValue)
              : undefined
          }
        />
        <AdminMetricCard
          detail="All registered customer accounts"
          icon={Users}
          isLoading={isLoading && !snapshot.overview}
          label="Customers"
          value={snapshot.overview?.totalCustomers.toLocaleString("en")}
        />
      </section>

      <section className="admin-dashboard-primary-grid" aria-label="Operational overview">
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
  const rows = [
    ["Pending payment", orders?.byStatus.PENDING_PAYMENT],
    ["Paid", orders?.byStatus.PAID],
    ["Cancelled", orders?.byStatus.CANCELLED],
    ["Expired", orders?.byStatus.EXPIRED],
  ] as const;

  return (
    <article className="admin-dashboard-card admin-dashboard-card--operations">
      <header className="admin-dashboard-card__header">
        <div>
          <p className="admin-dashboard-card__kicker">Operations</p>
          <h2>Store status</h2>
          <span>Current API totals for the selected range</span>
        </div>
      </header>

      <div className="admin-dashboard-operations-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            {isLoading && value === undefined ? (
              <span className="admin-dashboard-skeleton admin-dashboard-skeleton--compact" />
            ) : (
              <strong>{value?.toLocaleString("en") ?? "Unavailable"}</strong>
            )}
          </div>
        ))}
      </div>

      <div className="admin-dashboard-inventory-summary">
        <span>
          <small>Total products</small>
          <strong>{overview?.totalProducts.toLocaleString("en") ?? "Unavailable"}</strong>
        </span>
        <span>
          <small>Low-stock variants</small>
          <strong>{overview?.lowStockVariantsCount.toLocaleString("en") ?? "Unavailable"}</strong>
        </span>
      </div>
    </article>
  );
}

function formatRangeLabel(range: DashboardDateRange): string {
  const formatter = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${range.from}T00:00:00Z`))} – ${formatter.format(
    new Date(`${range.to}T00:00:00Z`),
  )}`;
}
