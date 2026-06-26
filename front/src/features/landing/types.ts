export interface FeaturedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  featuredOrder: number | null;
}

export interface LandingGalleryImage {
  id: string;
  imageUrl: string;
  title: string | null;
  caption: string | null;
  altText: string | null;
  sortOrder: number;
}

export interface AdminLandingGalleryImage extends LandingGalleryImage {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LandingGalleryResponse {
  images: LandingGalleryImage[];
}

export interface AdminLandingGalleryResponse {
  images: AdminLandingGalleryImage[];
  count: number;
  maxImages: number;
}

export interface AdminLandingGalleryImageResponse {
  image: AdminLandingGalleryImage;
}

export interface CreateAdminLandingGalleryImageRequest {
  imageUrl: string;
  title?: string | null;
  caption?: string | null;
  altText?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateAdminLandingGalleryImageRequest =
  Partial<CreateAdminLandingGalleryImageRequest>;

export interface ReorderAdminLandingGalleryImagesRequest {
  images: Array<{
    id: string;
    sortOrder: number;
  }>;
}

export interface AdminLandingGalleryDeleteResponse {
  deletedId: string;
}
