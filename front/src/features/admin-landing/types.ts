import type { FeaturedCategory } from "@/features/landing/types";

export interface AdminLandingPage {
  heroImageUrl: string | null;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  featuredCategories: FeaturedCategory[];
}

export interface UpdateAdminLandingPageRequest {
  heroImageUrl?: string | null;
  heroEyebrow?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
}
