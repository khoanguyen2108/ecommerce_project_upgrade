export interface StyleAdviceRequest {
  notes: string;
  previousOutfits?: StyleAdvicePreviousOutfit[];
  previousIntent?: StyleAdviceIntent;
  previousBudget?: number;
}

export interface StyleAdviceRecommendation {
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  price: number;
  reason: string;
  stylingTip?: string;
}

export type StyleAdviceOutfitProductRole =
  | "top"
  | "bottom"
  | "shoes"
  | "jacket"
  | "handbag"
  | "accessory";

export interface StyleAdviceIntent {
  categories: string[];
  colors: string[];
  styles: string[];
  occasions: string[];
  fits: string[];
  negativeConstraints: string[];
}

export interface StyleAdviceOutfitProduct {
  role: StyleAdviceOutfitProductRole;
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  price: number;
  matchedTags: string[];
}

export interface StyleAdviceOutfit {
  title: string;
  reason: string;
  score: number;
  matchedIntentTags: string[];
  products: StyleAdviceOutfitProduct[];
  warnings: string[];
}

export interface StyleAdvicePreviousOutfitProduct {
  role: StyleAdviceOutfitProductRole;
  productId: string;
  productSlug?: string;
  productName?: string;
  price?: number;
}

export interface StyleAdvicePreviousOutfit {
  optionIndex: number;
  title?: string;
  totalPrice?: number;
  locale?: "vi" | "en";
  products: StyleAdvicePreviousOutfitProduct[];
}

export interface StyleAdviceRefinement {
  applied: boolean;
  sourceOptionIndex?: number;
  action?: "replace" | "remove" | "keep" | "budget" | "fresh";
  targetRoles?: StyleAdviceOutfitProductRole[];
  keptProductIds?: string[];
  removedProductIds?: string[];
  replacedProductIds?: string[];
}

export interface StyleAdviceHandoff {
  required: boolean;
  reason?: string;
  suggestedMessage?: string;
}

export interface StyleAdviceResponse {
  mode:
    | "ai"
    | "catalog_fallback"
    | "deterministic_tag_recommender"
    | "out_of_scope";
  locale?: "vi" | "en";
  query?: string;
  intent?: StyleAdviceIntent;
  summary: string;
  outfits?: StyleAdviceOutfit[];
  recommendations: StyleAdviceRecommendation[];
  extraTips: string[];
  warnings?: string[];
  budget?: number;
  refinement?: StyleAdviceRefinement;
  handoff?: StyleAdviceHandoff;
}

export type StyleAdviceStatus = "idle" | "loading" | "success" | "error";
