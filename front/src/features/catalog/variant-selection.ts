import { isImplicitAccessoryOption, isNoSize, sortSizesByStandardOrder } from "@/features/catalog/sizes";
import type { Product, ProductVariant } from "@/features/catalog/types";

export function isVariantSelectable(
  variant: ProductVariant | undefined,
): variant is ProductVariant {
  return Boolean(variant?.isActive && variant.stock > 0);
}

export function hasSelectableColor(
  variants: ProductVariant[],
  color: string,
): boolean {
  return variants.some(
    (variant) => variant.color === color && isVariantSelectable(variant),
  );
}

export function getOnlySelectableColor(
  variants: ProductVariant[],
): string | undefined {
  const selectableColors = Array.from(
    new Set(variants.filter(isVariantSelectable).map((variant) => variant.color)),
  );

  return selectableColors.length === 1 ? selectableColors[0] : undefined;
}

export function hasSelectableCombination(
  variants: ProductVariant[],
  color: string,
  size?: string,
): boolean {
  return Boolean(
    color &&
      variants.some(
        (variant) =>
          variant.color === color &&
          variant.size === size &&
          isVariantSelectable(variant),
      ),
  );
}

export function getVariantColors(variants: ProductVariant[]): string[] {
  return Array.from(new Set(variants.map((variant) => variant.color)));
}

export function getVariantSizes(variants: ProductVariant[]): string[] {
  return sortSizesByStandardOrder(
    variants.map((variant) => variant.size).filter((size) => !isNoSize(size)),
  );
}

export function getSizesForColor(
  variants: ProductVariant[],
  color: string | undefined,
): string[] {
  if (!color) {
    return getVariantSizes(variants);
  }

  return sortSizesByStandardOrder(
    variants
      .filter((variant) => variant.color === color)
      .map((variant) => variant.size)
      .filter((size) => !isNoSize(size)),
  );
}

export function productRequiresSize(variants: ProductVariant[]): boolean {
  return variants.some((variant) => !isNoSize(variant.size));
}

export function resolveSelectedVariant({
  color,
  size,
  variants,
}: {
  color?: string;
  size?: string;
  variants: ProductVariant[];
}): ProductVariant | undefined {
  if (!color) {
    return undefined;
  }

  const requiresSize = productRequiresSize(variants);

  return variants.find(
    (variant) =>
      variant.color === color &&
      (!requiresSize || variant.size === size) &&
      isVariantSelectable(variant),
  );
}

export function getImplicitSelectableVariant(
  variants: ProductVariant[],
): ProductVariant | undefined {
  const selectableVariants = variants.filter(isVariantSelectable);

  return selectableVariants.length === 1 &&
    isImplicitAccessoryOption(selectableVariants[0])
    ? selectableVariants[0]
    : undefined;
}

export function getVariantUnitPrice(
  product: Product,
  variant: ProductVariant,
): number {
  return variant.priceOverride ?? product.basePrice;
}
