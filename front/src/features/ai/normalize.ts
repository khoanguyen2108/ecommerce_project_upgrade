import type {
  StyleAdviceCanonicalOutfit,
  StyleAdviceResponse,
} from "@/features/ai/types";

export function getCurrentStyleAdviceOutfit(
  response: StyleAdviceResponse,
): StyleAdviceCanonicalOutfit | undefined {
  if (response.type !== "outfit") {
    return undefined;
  }

  if (response.outfit) {
    return {
      ...response.outfit,
      summary:
        response.outfit.summary || response.message || response.summary || "",
      warnings: uniqueWarnings(
        response.outfit.warnings,
        response.warnings,
      ),
    };
  }

  // Compatibility fallback for the additive rollout. Only the first legacy
  // outfit is adapted; the customer never sees an option list.
  const legacyOutfit = response.outfits?.[0];

  if (!legacyOutfit) {
    return undefined;
  }

  return {
    summary:
      legacyOutfit.reason || response.message || response.summary || "",
    totalPrice: legacyOutfit.products.reduce(
      (total, product) => total + product.price,
      0,
    ),
    items: legacyOutfit.products.map((product) => ({
      role: product.role,
      productId: product.productId,
      productSlug: product.productSlug,
      productName: product.productName,
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      price: product.price,
    })),
    warnings: uniqueWarnings(legacyOutfit.warnings, response.warnings),
  };
}

function uniqueWarnings(
  ...warningGroups: Array<string[] | undefined>
): string[] {
  return [...new Set(warningGroups.flatMap((warnings) => warnings ?? []))];
}
