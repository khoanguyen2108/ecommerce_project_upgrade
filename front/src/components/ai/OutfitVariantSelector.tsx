import styles from "@/components/ai/OutfitPreparationDrawer.module.css";
import type { ProductVariant } from "@/features/catalog/types";
import {
  getImplicitSelectableVariant,
  getSizesForColor,
  getVariantColors,
  hasSelectableColor,
  hasSelectableCombination,
  isVariantSelectable,
  productRequiresSize,
} from "@/features/catalog/variant-selection";

interface OutfitVariantSelectorProps {
  onColorChange: (color: string) => void;
  onSizeChange: (size: string) => void;
  productName: string;
  selectedColor?: string;
  selectedSize?: string;
  selectedVariantId?: string;
  variants: ProductVariant[];
}

export function OutfitVariantSelector({
  onColorChange,
  onSizeChange,
  productName,
  selectedColor,
  selectedSize,
  selectedVariantId,
  variants,
}: OutfitVariantSelectorProps) {
  const implicitVariant = getImplicitSelectableVariant(variants);
  const requiresSize = productRequiresSize(variants);
  const colors = getVariantColors(variants);
  const sizes = getSizesForColor(variants, selectedColor);
  const selectedVariant = variants.find(
    (variant) =>
      variant.id === selectedVariantId && isVariantSelectable(variant),
  );

  if (implicitVariant) {
    return (
      <p className={styles.selectionStatus} role="status">
        Selected option: Default option
      </p>
    );
  }

  return (
    <div className={styles.selector}>
      <fieldset>
        <legend>Select color</legend>
        <div className={styles.optionList}>
          {colors.map((color) => {
            const isAvailable = hasSelectableColor(variants, color);
            const colorName = (color ?? "");

            return (
              <button
                aria-label={`Select color ${colorName} ${productName}${
                  isAvailable ? "" : ", Out of stock"
                }`}
                aria-pressed={color === selectedColor}
                className={color === selectedColor ? styles.selectedOption : undefined}
                disabled={!isAvailable}
                key={color}
                onClick={() => onColorChange(color)}
                type="button"
              >
                {colorName}
              </button>
            );
          })}
        </div>
      </fieldset>

      {requiresSize ? (
        <fieldset>
          <legend>Select size</legend>
          <div className={styles.optionList}>
            {sizes.map((size) => {
              const isAvailable = Boolean(
                selectedColor &&
                  hasSelectableCombination(variants, selectedColor, size),
              );

              return (
                <button
                  aria-label={`Select size ${size} ${productName}${
                    isAvailable ? "" : ", Out of stock"
                  }`}
                  aria-pressed={size === selectedSize}
                  className={size === selectedSize ? styles.selectedOption : undefined}
                  disabled={!isAvailable}
                  key={size}
                  onClick={() => onSizeChange(size)}
                  type="button"
                >
                  {size}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className={styles.selectionHint}>No size required.</p>
      )}

      {selectedVariant ? (
        <p className={styles.selectionStatus} role="status">
          Selected option: {(selectedVariant.color ?? "")}
          {requiresSize ? ` / ${selectedVariant.size}` : ""}
        </p>
      ) : null}
    </div>
  );
}
