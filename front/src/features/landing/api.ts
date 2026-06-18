import { apiRequest } from "@/lib/api/client";
import type { FeaturedCategory } from "@/features/landing/types";

export async function getFeaturedCategories(): Promise<FeaturedCategory[]> {
  const response = await apiRequest<{ categories: FeaturedCategory[] }>(
    "/categories/featured",
    { method: "GET" },
  );

  return response.categories;
}
