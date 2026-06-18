"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  Package,
  PanelsTopLeft,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AdminDashboardFilters,
  getDefaultDashboardDateRange,
  type DashboardDateRange,
} from "@/components/admin-dashboard/AdminDashboardFilters";
import { AdminMetricCard } from "@/components/admin-dashboard/AdminMetricCard";
import { MonthlySalesChart } from "@/components/admin-dashboard/MonthlySalesChart";
import { MonthlyTargetGauge } from "@/components/admin-dashboard/MonthlyTargetGauge";
import { StatisticsAreaChart } from "@/components/admin-dashboard/StatisticsAreaChart";
import {
  getAdminOrderStats,
  getAdminRevenue,
  getAdminStatsOverview,
} from "@/features/admin-stats/api";
import { getAdminStatsError } from "@/features/admin-stats/errors";
import type {
  AdminOrderStats,
  AdminRevenue,
  AdminStatsOverview,
} from "@/features/admin-stats/types";
import { formatPrice } from "@/features/catalog/format";

const LOCAL_MONTHLY_TARGET = 20_000_000;

interface DashboardSnapshot {
  orders?: AdminOrderStats;
  overview?: AdminStatsOverview;
  revenue?: AdminRevenue;
  targetRevenue?: number;
}

const quickLinks = [
  {
    description: "Update the storefront hero and featured category visuals.",
    href: "/admin/landing",
    icon: PanelsTopLeft,
    label: "Manage Landing Page",
  },
  {
    description: "Review fulfillment state and pending payment orders.",
    href: "/admin/orders",
    icon: ClipboardList,
    label: "Manage orders",
  },
  {
    description: "Inspect read-only payment and webhook diagnostics.",
    href: "/admin/payments",
    icon: CreditCard,
    label: "Payment diagnostics",
  },
  {
    description: "Update products, variants, inventory, and visibility.",
    href: "/admin/products",
    icon: Package,
    label: "Products",
  },
  {
    description: "Review customer accounts, roles, and access.",
    href: "/admin/users",
    icon: Users,
    label: "Users",
  },
] as const;

export function AdminDashboardPage() {
  const [range, setRange] = useState<DashboardDateRange>(
    getDefaultDashboardDateRange,
  );
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [requestIds, setRequestIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setErrors([]);
      setRequestIds([]);

      const dateQuery = { from: range.from, to: range.to };
      const currentMonthQuery = getCurrentMonthQuery();
      const results = await Promise.allSettled([
        getAdminStatsOverview(dateQuery),
        getAdminOrderStats(dateQuery),
        getAdminRevenue({ ...dateQuery, groupBy: "month" }),
        getAdminRevenue({ ...currentMonthQuery, groupBy: "month" }),
      ]);

      if (!isMounted) {
        return;
      }

      const [overviewResult, ordersResult, revenueResult, targetResult] = results;
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
        targetRevenue:
          targetResult.status === "fulfilled"
            ? targetResult.value.revenue.totalRevenue
            : undefined,
      });
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
        <div>
          <p className="admin-dashboard-modern__eyebrow">Admin overview</p>
          <h1 id="dashboard-heading">Operations dashboard</h1>
          <p>
            A clear view of customers, orders, and webhook-verified sales across
            Belikeme.
          </p>
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
          detail="All registered customer accounts"
          icon={Users}
          isLoading={isLoading && !snapshot.overview}
          label="Customers"
          value={snapshot.overview?.totalCustomers.toLocaleString("en")}
        />
        <AdminMetricCard
          detail={filterLabel}
          icon={ShoppingBag}
          isLoading={isLoading && !snapshot.orders}
          label="Orders"
          value={snapshot.orders?.total.toLocaleString("en")}
        />
        <AdminMetricCard
          detail="Verified paid revenue only"
          icon={CircleDollarSign}
          isLoading={isLoading && !snapshot.overview}
          label="Revenue"
          value={
            snapshot.overview
              ? formatPrice(snapshot.overview.totalRevenue)
              : undefined
          }
        />
        <AdminMetricCard
          detail="Awaiting payment completion"
          icon={Clock3}
          isLoading={isLoading && !snapshot.overview}
          label="Pending orders"
          value={snapshot.overview?.pendingOrdersCount.toLocaleString("en")}
        />
      </section>

      <section className="admin-dashboard-primary-grid" aria-label="Sales dashboard charts">
        <MonthlySalesChart
          buckets={snapshot.revenue?.buckets}
          isLoading={isLoading}
        />
        <MonthlyTargetGauge
          isLoading={isLoading}
          revenue={snapshot.targetRevenue}
          target={LOCAL_MONTHLY_TARGET}
        />
      </section>

      <StatisticsAreaChart
        buckets={snapshot.revenue?.buckets}
        isLoading={isLoading}
      />

      <section className="admin-dashboard-quick-links" aria-labelledby="quick-links-heading">
        <header>
          <div>
            <p className="admin-dashboard-card__kicker">Workspace</p>
            <h2 id="quick-links-heading">Quick links</h2>
          </div>
          <span>
            <ShieldCheck aria-hidden="true" size={16} /> Payment state remains
            webhook-authoritative
          </span>
        </header>
        <div>
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link href={link.href} key={link.href}>
                <span className="admin-dashboard-quick-links__icon">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.description}</small>
                </span>
                <ArrowUpRight aria-hidden="true" size={18} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function getCurrentMonthQuery(): DashboardDateRange {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    from: toDateInputValue(monthStart),
    to: toDateInputValue(today),
  };
}

function toDateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
