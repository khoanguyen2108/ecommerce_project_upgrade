export interface StyleAdviceRequest {
  notes: string;
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

export interface StyleAdviceHandoff {
  required: boolean;
  reason?: string;
  suggestedMessage?: string;
}

export interface StyleAdviceResponse {
  mode: "ai" | "catalog_fallback" | "out_of_scope";
  query?: string;
  intent?: StyleAdviceIntent;
  summary: string;
  outfits?: StyleAdviceOutfit[];
  recommendations: StyleAdviceRecommendation[];
  extraTips: string[];
  warnings?: string[];
  handoff?: StyleAdviceHandoff;
}

export type StyleAdviceStatus = "idle" | "loading" | "success" | "error";
