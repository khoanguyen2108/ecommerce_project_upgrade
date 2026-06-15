import type { Metadata } from "next";
import {
  AdminStatsPage,
  type AdminStatsInitialQuery,
} from "@/components/admin-stats/AdminStatsPage";
import type { AdminRevenueGroupBy } from "@/features/admin-stats/types";

export const metadata: Metadata = {
  title: "Stats",
};

interface AdminStatsRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminStatsRoute({
  searchParams,
}: AdminStatsRouteProps) {
  const params = searchParams ? await searchParams : {};

  return <AdminStatsPage initialQuery={parseInitialQuery(params)} />;
}

function parseInitialQuery(
  params: Record<string, string | string[] | undefined>,
): AdminStatsInitialQuery {
  return {
    from: parseDateInput(getFirst(params.from)),
    groupBy: parseGroupBy(getFirst(params.groupBy)) || "day",
    to: parseDateInput(getFirst(params.to)),
  };
}

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseDateInput(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
}

function parseGroupBy(value: string | undefined): AdminRevenueGroupBy | undefined {
  if (value === "day" || value === "week" || value === "month") {
    return value;
  }

  return undefined;
}
