export type SavedOutfitItemRole =
  | "top"
  | "bottom"
  | "shoes"
  | "jacket"
  | "accessory"
  | "handbag";

export interface SavedOutfitItemSnapshot {
  role: SavedOutfitItemRole;
  productId: string;
  variantId?: string;
  productNameSnapshot: string;
  productSlugSnapshot: string;
  imageUrlSnapshot?: string;
  unitPriceSnapshot: number;
  quantity: 1;
}

export interface SavedOutfit {
  id: string;
  sourcePrompt: string;
  summary: string;
  totalPriceSnapshot: number;
  items: SavedOutfitItemSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedOutfitRequest {
  sourcePrompt: string;
  summary: string;
  items: SavedOutfitItemSnapshot[];
}

export interface SavedOutfitListResponse {
  savedOutfits: SavedOutfit[];
}

export interface SavedOutfitResponse {
  savedOutfit: SavedOutfit;
}

export interface DeleteSavedOutfitResponse {
  deleted: true;
  id: string;
}
