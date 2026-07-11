export type StyleAdviceResponseType =
  | "clarification"
  | "outfit"
  | "out_of_scope";

export type StyleAdviceOutfitProductRole =
  | "top"
  | "bottom"
  | "shoes"
  | "jacket"
  | "accessory"
  | "handbag";

export interface StyleAdviceRequest {
  message: string;
  currentOutfit?: StyleAdviceCurrentOutfitRequest;
}

export interface StyleAdviceCurrentOutfitRequest {
  items: Array<{
    role: StyleAdviceOutfitProductRole;
    productId: string;
    variantId?: string;
  }>;
  intent?: StyleAdviceIntent;
  budget?: number;
  locale?: "vi" | "en";
}

export interface StyleAdviceCanonicalOutfitItem {
  role: StyleAdviceOutfitProductRole;
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  price: number;
  variantRequired?: boolean;
}

export interface StyleAdviceCanonicalOutfit {
  summary: string;
  totalPrice: number;
  items: StyleAdviceCanonicalOutfitItem[];
  warnings?: string[];
}

export interface StyleAdviceIntent {
  categories: string[];
  colors: string[];
  styles: string[];
  occasions: string[];
  fits: string[];
  negativeConstraints: string[];
}

// Deprecated response types remain only for the rollout fallback.
export type StyleAdviceOutfitProduct = StyleAdviceCanonicalOutfitItem;

export interface StyleAdviceOutfit {
  title: string;
  reason: string;
  products: StyleAdviceOutfitProduct[];
  warnings: string[];
}

export interface StyleAdviceRefinement {
  applied: boolean;
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
  type: StyleAdviceResponseType;
  locale?: "vi" | "en";
  message?: string;
  clarificationQuestion?: string;
  outfit?: StyleAdviceCanonicalOutfit;

  // Deprecated compatibility fields. Customer rendering reads canonical fields
  // first and uses only outfits[0] when the canonical outfit is absent.
  outfits?: StyleAdviceOutfit[];
  query?: string;
  intent?: StyleAdviceIntent;
  summary?: string;
  extraTips?: string[];
  warnings?: string[];
  budget?: number;
  refinement?: StyleAdviceRefinement;
  handoff?: StyleAdviceHandoff;
}

export type StyleAdviceStatus = "idle" | "loading" | "success" | "error";
