import type { Metadata } from "next";
import { AdminVouchersPage } from "@/components/admin-vouchers/AdminVouchersPage";
import type { AdminVoucherQuery } from "@/features/admin-vouchers/types";

export const metadata: Metadata = { title: "Vouchers" };

interface AdminVouchersRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminVouchersRoute({
  searchParams,
}: AdminVouchersRouteProps) {
  const params = searchParams ? await searchParams : {};
  return <AdminVouchersPage initialQuery={parseInitialQuery(params)} />;
}

function parseInitialQuery(
  params: Record<string, string | string[] | undefined>,
): AdminVoucherQuery {
  return {
    isActive: parseBoolean(getFirst(params.isActive)),
    limit: 8,
    page: parsePositiveInteger(getFirst(params.page)) || 1,
    search: getFirst(params.search),
  };
}

function getFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
