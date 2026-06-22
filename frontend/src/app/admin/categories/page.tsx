import type { Metadata } from "next";
import { AdminCategoriesPage } from "@/components/admin-catalog/AdminCategoriesPage";
import type { AdminCategoryQuery } from "@/features/admin-catalog/types";

export const metadata: Metadata = {
  title: "Categories",
};

interface AdminCategoriesRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminCategoriesRoute({
  searchParams,
}: AdminCategoriesRouteProps) {
  const params = searchParams ? await searchParams : {};

  return <AdminCategoriesPage initialQuery={parseInitialQuery(params)} />;
}

function parseInitialQuery(
  params: Record<string, string | string[] | undefined>,
): AdminCategoryQuery {
  return {
    isActive: parseBoolean(getFirst(params.isActive)),
    limit: 20,
    page: parsePositiveInteger(getFirst(params.page)) || 1,
    search: getFirst(params.search),
  };
}

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
