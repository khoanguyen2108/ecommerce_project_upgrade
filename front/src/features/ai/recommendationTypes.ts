export interface ProductRecommendationRequest {
  query: string;
  minBudget?: number;
  maxBudget?: number;
  categorySlugs?: string[];
  colors?: string[];
  sizes?: string[];
  limit: number;
}

export interface ProductRecommendationAppliedFilters {
  minBudget?: number;
  maxBudget?: number;
  categorySlugs: string[];
  colors: string[];
  sizes: string[];
  activeOnly: true;
  inStockOnly: true;
}

export interface ProductRecommendation {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  price: number;
  availableColors: string[];
  availableSizes: string[];
  reason: string;
}

export interface ProductRecommendationResponse {
  mode: "ai" | "catalog_fallback" | "out_of_scope";
  summary: string;
  appliedFilters: ProductRecommendationAppliedFilters;
  recommendations: ProductRecommendation[];
  noMatchSuggestions: string[];
}

export type ProductRecommendationStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

export interface RecommendationFilterState {
  minBudget: string;
  maxBudget: string;
  categorySlug: string;
  colors: string[];
  size: string;
  styles: string[];
}

export const EMPTY_RECOMMENDATION_FILTERS: RecommendationFilterState = {
  minBudget: "",
  maxBudget: "",
  categorySlug: "",
  colors: [],
  size: "",
  styles: [],
};
