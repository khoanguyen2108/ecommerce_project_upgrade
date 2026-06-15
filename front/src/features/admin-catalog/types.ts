import type { Pagination } from "@/lib/api/types";

export type AdminSortOrder = "asc" | "desc";

export type AdminCategorySort =
  | "createdAt"
  | "updatedAt"
  | "name"
  | "slug"
  | "isActive";

export type AdminProductSort =
  | "createdAt"
  | "updatedAt"
  | "name"
  | "slug"
  | "basePrice"
  | "isActive";

export type AdminVariantStockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export type AdminVariantSort =
  | "createdAt"
  | "updatedAt"
  | "sku"
  | "size"
  | "color"
  | "stock"
  | "isActive";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductCategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface AdminProductVariant {
  id: string;
  productId: string;
  sku: string | null;
  size: string;
  color: string;
  stock: number;
  priceOverride: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  imageUrls: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: AdminProductCategorySummary;
  variants: AdminProductVariant[];
}

export interface AdminCategoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sort?: AdminCategorySort;
  order?: AdminSortOrder;
}

export interface AdminProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  categorySlug?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: AdminProductSort;
  order?: AdminSortOrder;
}

export interface AdminProductVariantQuery {
  page?: number;
  limit?: number;
  sku?: string;
  size?: string;
  color?: string;
  isActive?: boolean;
  stockStatus?: AdminVariantStockStatus;
  sort?: AdminVariantSort;
  order?: AdminSortOrder;
}

export interface CreateAdminCategoryRequest {
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateAdminCategoryRequest {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateAdminProductRequest {
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  basePrice: number;
  imageUrls?: string[];
  isActive?: boolean;
}

export interface UpdateAdminProductRequest {
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  basePrice?: number;
  imageUrls?: string[];
  isActive?: boolean;
}

export interface CreateAdminProductVariantRequest {
  sku?: string | null;
  size: string;
  color: string;
  stock: number;
  priceOverride?: number | null;
  isActive?: boolean;
}

export interface UpdateAdminProductVariantRequest {
  sku?: string | null;
  size?: string;
  color?: string;
  stock?: number;
  priceOverride?: number | null;
  isActive?: boolean;
}

export interface AdminCategoriesListResponse {
  categories: AdminCategory[];
  pagination: Pagination;
}

export interface AdminCategoryResponse {
  category: AdminCategory;
}

export interface AdminProductsListResponse {
  products: AdminProduct[];
  pagination: Pagination;
}

export interface AdminProductResponse {
  product: AdminProduct;
}

export interface AdminProductVariantsListResponse {
  variants: AdminProductVariant[];
  pagination: Pagination;
}

export interface AdminProductVariantResponse {
  variant: AdminProductVariant;
}
