import type { Metadata } from "next";
import { AdminProductsPage } from "@/components/admin-catalog/AdminProductsPage";
import type {
  AdminProductQuery,
  AdminProductSort,
  AdminSortOrder,
} from "@/features/admin-catalog/types";

export const metadata: Metadata = {
  title: "Products",
};

interface AdminProductsRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminProductsRoute({
  searchParams,
}: AdminProductsRouteProps) {
  const params = searchParams ? await searchParams : {};

  return <AdminProductsPage initialQuery={parseInitialQuery(params)} />;
}

function parseInitialQuery(
  params: Record<string, string | string[] | undefined>,
): AdminProductQuery {
  return {
    categoryId: getFirst(params.categoryId),
    isActive: parseBoolean(getFirst(params.isActive)),
    limit: 20,
    maxPrice: parseNonNegativeInteger(getFirst(params.maxPrice)),
    minPrice: parseNonNegativeInteger(getFirst(params.minPrice)),
    order: parseOrder(getFirst(params.order)) || "desc",
    page: parsePositiveInteger(getFirst(params.page)) || 1,
    search: getFirst(params.search),
    sort: parseSort(getFirst(params.sort)) || "createdAt",
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

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseSort(value: string | undefined): AdminProductSort | undefined {
  if (
    value === "createdAt" ||
    value === "updatedAt" ||
    value === "name" ||
    value === "slug" ||
    value === "basePrice" ||
    value === "isActive"
  ) {
    return value;
  }

  return undefined;
}

function parseOrder(value: string | undefined): AdminSortOrder | undefined {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return undefined;
}
