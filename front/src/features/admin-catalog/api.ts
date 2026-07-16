import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  AdminCategoriesListResponse,
  AdminCategoryQuery,
  AdminCategoryResponse,
  AdminCategoryImageMutationResponse,
  AdminDeleteResponse,
  AdminProductQuery,
  AdminProductImageMutationResponse,
  AdminProductResponse,
  AdminProductsListResponse,
  AdminProductVariantQuery,
  AdminProductVariantResponse,
  AdminProductVariantsListResponse,
  CreateAdminCategoryRequest,
  CreateAdminProductRequest,
  CreateAdminProductVariantRequest,
  ReorderAdminCategoryRequest,
  UpdateAdminCategoryRequest,
  UpdateAdminProductRequest,
  UpdateAdminProductVariantRequest,
} from "@/features/admin-catalog/types";

export function listAdminCategories(
  query: AdminCategoryQuery = {},
): Promise<AdminCategoriesListResponse> {
  return apiRequest<AdminCategoriesListResponse>(
    withQuery("/admin/categories", query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function getAdminCategory(id: string): Promise<AdminCategoryResponse> {
  return apiRequest<AdminCategoryResponse>(
    `/admin/categories/${encodeURIComponent(id)}`,
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function createAdminCategory(
  payload: CreateAdminCategoryRequest,
): Promise<AdminCategoryResponse> {
  return apiRequest<AdminCategoryResponse>("/admin/categories", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });
}

export function updateAdminCategory(
  id: string,
  payload: UpdateAdminCategoryRequest,
): Promise<AdminCategoryResponse> {
  return apiRequest<AdminCategoryResponse>(
    `/admin/categories/${encodeURIComponent(id)}`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function deactivateAdminCategory(
  id: string,
): Promise<AdminCategoryResponse> {
  return apiRequest<AdminCategoryResponse>(
    `/admin/categories/${encodeURIComponent(id)}/deactivate`,
    {
      auth: true,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function activateAdminCategory(id: string): Promise<AdminCategoryResponse> {
  return apiRequest<AdminCategoryResponse>(
    `/admin/categories/${encodeURIComponent(id)}/activate`,
    { auth: true, credentials: "include", method: "PATCH" },
  );
}

export function deleteAdminCategory(id: string): Promise<AdminDeleteResponse> {
  return apiRequest<AdminDeleteResponse>(
    `/admin/categories/${encodeURIComponent(id)}`,
    { auth: true, credentials: "include", method: "DELETE" },
  );
}

export function reorderAdminCategory(
  id: string,
  payload: ReorderAdminCategoryRequest,
): Promise<AdminCategoryResponse> {
  return apiRequest<AdminCategoryResponse>(
    `/admin/categories/${encodeURIComponent(id)}/reorder`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function listAdminProducts(
  query: AdminProductQuery = {},
): Promise<AdminProductsListResponse> {
  return apiRequest<AdminProductsListResponse>(
    withQuery("/admin/products", query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function getAdminProduct(id: string): Promise<AdminProductResponse> {
  return apiRequest<AdminProductResponse>(
    `/admin/products/${encodeURIComponent(id)}`,
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function createAdminProduct(
  payload: CreateAdminProductRequest,
): Promise<AdminProductResponse> {
  return apiRequest<AdminProductResponse>("/admin/products", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });
}

export function updateAdminProduct(
  id: string,
  payload: UpdateAdminProductRequest,
): Promise<AdminProductResponse> {
  return apiRequest<AdminProductResponse>(
    `/admin/products/${encodeURIComponent(id)}`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function uploadAdminCategoryImage(
  categoryId: string,
  file: File,
): Promise<AdminCategoryImageMutationResponse> {
  const body = new FormData();
  body.append("file", file);

  return apiRequest<AdminCategoryImageMutationResponse>(
    `/admin/categories/${encodeURIComponent(categoryId)}/image`,
    {
      auth: true,
      body,
      credentials: "include",
      method: "POST",
    },
  );
}

export function deleteAdminCategoryImage(
  categoryId: string,
): Promise<AdminCategoryImageMutationResponse> {
  return apiRequest<AdminCategoryImageMutationResponse>(
    `/admin/categories/${encodeURIComponent(categoryId)}/image`,
    { auth: true, credentials: "include", method: "DELETE" },
  );
}

export function uploadAdminProductImage(
  productId: string,
  file: File,
): Promise<AdminProductImageMutationResponse> {
  const body = new FormData();
  body.append("file", file);

  return apiRequest<AdminProductImageMutationResponse>(
    `/admin/products/${encodeURIComponent(productId)}/images`,
    {
      auth: true,
      body,
      credentials: "include",
      method: "POST",
    },
  );
}

export function deleteAdminProductImage(
  productId: string,
  imageId: string,
): Promise<AdminProductImageMutationResponse> {
  return apiRequest<AdminProductImageMutationResponse>(
    `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
    { auth: true, credentials: "include", method: "DELETE" },
  );
}

export function reorderAdminProductImages(
  productId: string,
  imageIds: string[],
): Promise<AdminProductResponse> {
  return apiRequest<AdminProductResponse>(
    `/admin/products/${encodeURIComponent(productId)}/images/reorder`,
    {
      auth: true,
      body: { imageIds },
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function deactivateAdminProduct(
  id: string,
): Promise<AdminProductResponse> {
  return apiRequest<AdminProductResponse>(
    `/admin/products/${encodeURIComponent(id)}/deactivate`,
    {
      auth: true,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function activateAdminProduct(id: string): Promise<AdminProductResponse> {
  return apiRequest<AdminProductResponse>(
    `/admin/products/${encodeURIComponent(id)}/activate`,
    { auth: true, credentials: "include", method: "PATCH" },
  );
}

export function deleteAdminProduct(id: string): Promise<AdminDeleteResponse> {
  return apiRequest<AdminDeleteResponse>(
    `/admin/products/${encodeURIComponent(id)}`,
    { auth: true, credentials: "include", method: "DELETE" },
  );
}

export function listAdminProductVariants(
  productId: string,
  query: AdminProductVariantQuery = {},
): Promise<AdminProductVariantsListResponse> {
  return apiRequest<AdminProductVariantsListResponse>(
    withQuery(`/admin/products/${encodeURIComponent(productId)}/variants`, query),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function getAdminProductVariant(
  id: string,
): Promise<AdminProductVariantResponse> {
  return apiRequest<AdminProductVariantResponse>(
    `/admin/product-variants/${encodeURIComponent(id)}`,
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function createAdminProductVariant(
  productId: string,
  payload: CreateAdminProductVariantRequest,
): Promise<AdminProductVariantResponse> {
  return apiRequest<AdminProductVariantResponse>(
    `/admin/products/${encodeURIComponent(productId)}/variants`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "POST",
    },
  );
}

export function updateAdminProductVariant(
  id: string,
  payload: UpdateAdminProductVariantRequest,
): Promise<AdminProductVariantResponse> {
  return apiRequest<AdminProductVariantResponse>(
    `/admin/product-variants/${encodeURIComponent(id)}`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function deactivateAdminProductVariant(
  id: string,
): Promise<AdminProductVariantResponse> {
  return apiRequest<AdminProductVariantResponse>(
    `/admin/product-variants/${encodeURIComponent(id)}`,
    {
      auth: true,
      credentials: "include",
      method: "DELETE",
    },
  );
}
