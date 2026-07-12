import { apiRequest } from "@/lib/api/client";
import type {
  Category,
  Product,
  ProductListResponse,
  ProductQuery,
  ProductVariant,
} from "@/features/catalog/types";

export async function getCategories(): Promise<Category[]> {
  const response = await apiRequest<{ categories: Category[] }>("/categories", {
    method: "GET",
  });

  return response.categories;
}

export async function getCategoryBySlug(slug: string): Promise<Category> {
  const response = await apiRequest<{ category: Category }>(
    `/categories/slug/${encodeURIComponent(slug)}`,
    {
      method: "GET",
    },
  );

  return response.category;
}

export function getProducts(query: ProductQuery = {}): Promise<ProductListResponse> {
  const searchParams = new URLSearchParams();

  appendQuery(searchParams, "page", query.page);
  appendQuery(searchParams, "limit", query.limit);
  appendQuery(searchParams, "search", query.search);
  appendQuery(searchParams, "categorySlug", query.categorySlug);
  appendQuery(searchParams, "size", query.size);
  appendQuery(searchParams, "color", query.color);
  appendQuery(searchParams, "minPrice", query.minPrice);
  appendQuery(searchParams, "maxPrice", query.maxPrice);
  appendQuery(searchParams, "sort", query.sort);

  const queryString = searchParams.toString();

  return apiRequest<ProductListResponse>(
    queryString ? `/products?${queryString}` : "/products",
    {
      method: "GET",
    },
  );
}

export async function getProductById(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<Product> {
  const response = await apiRequest<{ product: Product }>(`/products/${id}`, {
    method: "GET",
    signal: options.signal,
  });

  return response.product;
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const response = await apiRequest<{ product: Product }>(
    `/products/slug/${encodeURIComponent(slug)}`,
    {
      method: "GET",
    },
  );

  return response.product;
}

export async function getProductVariants(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProductVariant[]> {
  const response = await apiRequest<{ variants: ProductVariant[] }>(
    `/products/${id}/variants`,
    {
      method: "GET",
      signal: options.signal,
    },
  );

  return response.variants;
}

export async function getProductVariantsBySlug(
  slug: string,
): Promise<ProductVariant[]> {
  const response = await apiRequest<{ variants: ProductVariant[] }>(
    `/products/slug/${encodeURIComponent(slug)}/variants`,
    {
      method: "GET",
    },
  );

  return response.variants;
}

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}
