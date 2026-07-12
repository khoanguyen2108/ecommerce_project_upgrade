import type {
  StyleAdviceCanonicalOutfit,
  StyleAdviceOutfitProductRole,
} from "@/features/ai/types";
import type { SavedOutfit } from "@/features/saved-outfits/types";

export interface PurchasableOutfitItem {
  role: StyleAdviceOutfitProductRole;
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  snapshotPrice?: number;
  variantId?: string;
}

export interface PurchasableOutfit {
  source: "current" | "saved";
  savedOutfitId?: string;
  summary: string;
  items: PurchasableOutfitItem[];
}

export function toCurrentPurchasableOutfit(
  outfit: StyleAdviceCanonicalOutfit,
): PurchasableOutfit {
  return {
    source: "current",
    summary: outfit.summary,
    items: outfit.items.map((item) => ({
      role: item.role,
      productId: item.productId,
      productSlug: item.productSlug,
      productName: item.productName,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      snapshotPrice: item.price,
    })),
  };
}

export function toSavedPurchasableOutfit(
  savedOutfit: SavedOutfit,
): PurchasableOutfit {
  return {
    source: "saved",
    savedOutfitId: savedOutfit.id,
    summary: savedOutfit.summary,
    items: savedOutfit.items.map((item) => ({
      role: item.role,
      productId: item.productId,
      productSlug: item.productSlugSnapshot,
      productName: item.productNameSnapshot,
      ...(item.imageUrlSnapshot ? { imageUrl: item.imageUrlSnapshot } : {}),
      snapshotPrice: item.unitPriceSnapshot,
      ...(item.variantId ? { variantId: item.variantId } : {}),
    })),
  };
}
