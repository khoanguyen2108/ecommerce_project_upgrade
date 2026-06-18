import { apiRequest } from "@/lib/api/client";
import type {
  FeaturedCategory,
  LandingPageData,
} from "@/features/landing/types";

export function getLandingPage(): Promise<LandingPageData> {
  return apiRequest<LandingPageData>("/landing-page", {
    method: "GET",
  });
}

export async function getFeaturedCategories(): Promise<FeaturedCategory[]> {
  const response = await apiRequest<{ categories: FeaturedCategory[] }>(
    "/categories/featured",
    { method: "GET" },
  );

  return response.categories;
}
