import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  AdminDateRangeQuery,
  AdminOrderStatsQuery,
  AdminOrderStatsResponse,
  AdminRevenueQuery,
  AdminRevenueResponse,
  AdminStatsOverviewResponse,
  AdminTopProductsQuery,
  AdminTopProductsResponse,
} from "@/features/admin-stats/types";

export function getAdminStatsOverview(
  query: AdminDateRangeQuery = {},
): Promise<AdminStatsOverviewResponse> {
  return apiRequest<AdminStatsOverviewResponse>(
    withQuery("/admin/stats/overview", query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function getAdminRevenue(
  query: AdminRevenueQuery = {},
): Promise<AdminRevenueResponse> {
  return apiRequest<AdminRevenueResponse>(
    withQuery("/admin/stats/revenue", query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function getAdminTopProducts(
  query: AdminTopProductsQuery = {},
): Promise<AdminTopProductsResponse> {
  return apiRequest<AdminTopProductsResponse>(
    withQuery("/admin/stats/top-products", query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function getAdminOrderStats(
  query: AdminOrderStatsQuery = {},
): Promise<AdminOrderStatsResponse> {
  return apiRequest<AdminOrderStatsResponse>(
    withQuery("/admin/stats/orders", query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}
