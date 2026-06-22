import type { Metadata } from "next";
import { ProductListingPage } from "@/components/catalog/ProductListingPage";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { ProductQuery } from "@/features/catalog/types";

export const metadata: Metadata = {
  title: "Products",
};

interface ProductsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <>
      <SiteHeader active="shop" />
      <ProductListingPage initialQuery={parseInitialQuery(params)} />
      <SiteFooter />
    </>
  );
}

function parseInitialQuery(
  params: Record<string, string | string[] | undefined>,
): ProductQuery {
  const sort = parseSort(getFirst(params.sort));

  return {
    categorySlug: getFirst(params.categorySlug),
    limit: 12,
    page: parsePositiveNumber(getFirst(params.page)) || 1,
    search: getFirst(params.search),
    sort,
  };
}

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function parseSort(value: string | undefined): ProductQuery["sort"] | undefined {
  if (value === "newest" || value === "price_asc" || value === "price_desc") {
    return value;
  }

  return undefined;
}
