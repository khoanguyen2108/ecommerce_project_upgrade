import type { Metadata } from "next";
import { AdminOrdersPage } from "@/components/admin-orders/AdminOrdersPage";
import type {
  AdminOrderQuery,
  AdminOrderSort,
  AdminOrderSortDirection,
} from "@/features/admin-orders/types";
import type {
  OrderFulfillmentStatus,
  OrderStatus,
} from "@/features/orders/types";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersRoute({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  return <AdminOrdersPage initialQuery={parseQuery(params)} />;
}

function parseQuery(params: Record<string, string | string[] | undefined>): AdminOrderQuery {
  return {
    from: date(getFirst(params.from)),
    fulfillmentStatus: fulfillmentStatus(getFirst(params.fulfillmentStatus)),
    limit: 20,
    order: direction(getFirst(params.order)) || "desc",
    page: positiveInteger(getFirst(params.page)) || 1,
    search: getFirst(params.search),
    sort: sort(getFirst(params.sort)) || "createdAt",
    status: status(getFirst(params.status)),
    to: date(getFirst(params.to)),
  };
}

function getFirst(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function positiveInteger(value?: string) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; }
function date(value?: string) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined; }
function direction(value?: string): AdminOrderSortDirection | undefined { return value === "asc" || value === "desc" ? value : undefined; }
function sort(value?: string): AdminOrderSort | undefined { return value === "createdAt" || value === "updatedAt" || value === "totalAmount" || value === "paidAt" ? value : undefined; }
function status(value?: string): OrderStatus | undefined { return value === "PENDING_PAYMENT" || value === "PAID" || value === "CANCELLED" || value === "EXPIRED" ? value : undefined; }
function fulfillmentStatus(value?: string): OrderFulfillmentStatus | undefined { return value === "PENDING" || value === "PICKED_UP" || value === "IN_TRANSIT" || value === "OUT_FOR_DELIVERY" || value === "DELIVERED" || value === "RETURNED" ? value : undefined; }
