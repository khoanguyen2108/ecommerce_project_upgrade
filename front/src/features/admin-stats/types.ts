import type { OrderStatus } from "@/features/orders/types";

export type AdminRevenueGroupBy = "day" | "week" | "month";

export interface AdminDateRangeQuery {
  from?: string;
  to?: string;
}

export interface AdminRevenueQuery extends AdminDateRangeQuery {
  groupBy?: AdminRevenueGroupBy;
}

export interface AdminTopProductsQuery extends AdminDateRangeQuery {
  limit?: number;
}

export interface AdminOrderStatsQuery extends AdminDateRangeQuery {
  status?: OrderStatus;
}

export interface AdminStatsFilters {
  from: string | null;
  to: string | null;
}

export interface AdminStatsOverview {
  totalRevenue: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  expiredOrdersCount: number;
  averagePaidOrderValue: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockVariantsCount: number;
  filters: AdminStatsFilters;
}

export interface AdminStatsOverviewResponse {
  overview: AdminStatsOverview;
}

export interface AdminRevenueBucket {
  periodStart: string;
  periodEnd: string;
  revenue: number;
  paidOrdersCount: number;
}

export interface AdminRevenue {
  groupBy: AdminRevenueGroupBy;
  totalRevenue: number;
  paidOrdersCount: number;
  buckets: AdminRevenueBucket[];
  filters: AdminStatsFilters;
}

export interface AdminRevenueResponse {
  revenue: AdminRevenue;
}

export interface AdminTopProduct {
  categoryName: string;
  imageUrl: string | null;
  name: string;
  productId: string;
  slug: string;
  soldQuantity: number;
}

export interface AdminTopProductsResponse {
  topProducts: AdminTopProduct[];
  limit: number;
  filters: AdminStatsFilters;
}

export type AdminOrderStatsByStatus = Record<OrderStatus, number>;

export interface AdminOrderStatusCount {
  status: OrderStatus;
  count: number;
}

export interface AdminOrderStatsFilters extends AdminStatsFilters {
  status: OrderStatus | null;
}

export interface AdminOrderStats {
  total: number;
  byStatus: AdminOrderStatsByStatus;
  counts: AdminOrderStatusCount[];
  filters: AdminOrderStatsFilters;
}

export interface AdminOrderStatsResponse {
  orders: AdminOrderStats;
}
