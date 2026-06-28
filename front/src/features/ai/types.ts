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

export interface StyleAdviceHandoff {
  required: boolean;
  reason?: string;
  suggestedMessage?: string;
}

export interface StyleAdviceResponse {
  mode: "ai" | "catalog_fallback" | "out_of_scope";
  summary: string;
  recommendations: StyleAdviceRecommendation[];
  extraTips: string[];
  handoff?: StyleAdviceHandoff;
}

export type StyleAdviceStatus = "idle" | "loading" | "success" | "error";
