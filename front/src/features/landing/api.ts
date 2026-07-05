import { apiRequest } from "@/lib/api/client";
import type {
  AdminLandingGalleryDeleteResponse,
  AdminLandingGalleryImageResponse,
  AdminLandingGalleryResponse,
  CreateAdminLandingGalleryImageRequest,
  FeaturedCategory,
  LandingGalleryImage,
  LandingGalleryResponse,
  ReorderAdminLandingGalleryImagesRequest,
  UpdateAdminLandingGalleryImageRequest,
} from "@/features/landing/types";

export async function getFeaturedCategories(): Promise<FeaturedCategory[]> {
  const response = await apiRequest<{ categories: FeaturedCategory[] }>(
    "/categories/featured",
    { method: "GET" },
  );

  return response.categories;
}

export async function getLandingGallery(): Promise<LandingGalleryImage[]> {
  const response = await apiRequest<LandingGalleryResponse>("/landing-gallery", {
    method: "GET",
  });

  return response.images;
}

export function getAdminLandingGallery(): Promise<AdminLandingGalleryResponse> {
  return apiRequest<AdminLandingGalleryResponse>("/admin/landing-gallery", {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function createAdminLandingGalleryImage(
  payload: CreateAdminLandingGalleryImageRequest,
): Promise<AdminLandingGalleryImageResponse> {
  return apiRequest<AdminLandingGalleryImageResponse>("/admin/landing-gallery", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });
}

export function updateAdminLandingGalleryImage(
  imageId: string,
  payload: UpdateAdminLandingGalleryImageRequest,
): Promise<AdminLandingGalleryImageResponse> {
  return apiRequest<AdminLandingGalleryImageResponse>(
    `/admin/landing-gallery/${encodeURIComponent(imageId)}`,
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}

export function uploadAdminLandingGalleryImage(
  imageId: string,
  file: File,
): Promise<AdminLandingGalleryImageResponse> {
  const body = new FormData();
  body.append("file", file);

  return apiRequest<AdminLandingGalleryImageResponse>(
    `/admin/landing-gallery/${encodeURIComponent(imageId)}/image`,
    {
      auth: true,
      body,
      credentials: "include",
      method: "POST",
    },
  );
}

export function deleteAdminLandingGalleryImageFile(
  imageId: string,
): Promise<AdminLandingGalleryImageResponse> {
  return apiRequest<AdminLandingGalleryImageResponse>(
    `/admin/landing-gallery/${encodeURIComponent(imageId)}/image`,
    { auth: true, credentials: "include", method: "DELETE" },
  );
}

export function deleteAdminLandingGalleryImage(
  imageId: string,
): Promise<AdminLandingGalleryDeleteResponse> {
  return apiRequest<AdminLandingGalleryDeleteResponse>(
    `/admin/landing-gallery/${encodeURIComponent(imageId)}`,
    {
      auth: true,
      credentials: "include",
      method: "DELETE",
    },
  );
}

export function reorderAdminLandingGalleryImages(
  payload: ReorderAdminLandingGalleryImagesRequest,
): Promise<AdminLandingGalleryResponse> {
  return apiRequest<AdminLandingGalleryResponse>(
    "/admin/landing-gallery/reorder",
    {
      auth: true,
      body: payload,
      credentials: "include",
      method: "PATCH",
    },
  );
}
