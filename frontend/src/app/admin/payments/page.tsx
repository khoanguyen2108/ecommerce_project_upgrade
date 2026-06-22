import type { Metadata } from "next";
import { AdminPaymentsPage } from "@/components/admin-payments/AdminPaymentsPage";
import type {
  AdminPaymentQuery,
  AdminPaymentSort,
  AdminPaymentSortDirection,
} from "@/features/admin-payments/types";
import type { PaymentProvider, PaymentStatus } from "@/features/orders/types";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPaymentsRoute({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  return <AdminPaymentsPage initialQuery={parseQuery(params)} />;
}

function parseQuery(params: Record<string, string | string[] | undefined>): AdminPaymentQuery {
  return {
    from: date(getFirst(params.from)), limit: 20,
    order: direction(getFirst(params.order)) || "desc",
    page: positiveInteger(getFirst(params.page)) || 1,
    provider: provider(getFirst(params.provider)),
    search: getFirst(params.search), sort: sort(getFirst(params.sort)) || "createdAt",
    status: status(getFirst(params.status)), to: date(getFirst(params.to)),
  };
}

function getFirst(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function positiveInteger(value?: string) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; }
function date(value?: string) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined; }
function direction(value?: string): AdminPaymentSortDirection | undefined { return value === "asc" || value === "desc" ? value : undefined; }
function sort(value?: string): AdminPaymentSort | undefined { return value === "createdAt" || value === "updatedAt" || value === "paidAt" || value === "amount" ? value : undefined; }
function provider(value?: string): PaymentProvider | undefined { return value === "PAYOS" ? value : undefined; }
function status(value?: string): PaymentStatus | undefined { return value === "PENDING" || value === "PAID" || value === "FAILED" || value === "CANCELLED" || value === "EXPIRED" ? value : undefined; }
