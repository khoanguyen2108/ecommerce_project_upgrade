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
  locale: "vi" | "en";
  onColorChange: (color: string) => void;
  onSizeChange: (size: string) => void;
  productName: string;
  selectedColor?: string;
  selectedSize?: string;
  selectedVariantId?: string;
  variants: ProductVariant[];
}

const SELECTOR_COPY = {
  en: {
    color: "Select color",
    noSize: "No size required.",
    outOfStock: "Out of stock",
    selected: "Selected option",
    size: "Select size",
  },
  vi: {
    color: "Chọn màu",
    noSize: "Không cần chọn kích thước.",
    outOfStock: "Hết hàng",
    selected: "Lựa chọn hiện tại",
    size: "Chọn kích thước",
  },
} as const;

export function OutfitVariantSelector({
  locale,
  onColorChange,
  onSizeChange,
  productName,
  selectedColor,
  selectedSize,
  selectedVariantId,
  variants,
}: OutfitVariantSelectorProps) {
  const copy = SELECTOR_COPY[locale];
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
        {copy.selected}: {locale === "vi" ? "Tùy chọn mặc định" : "Default option"}
      </p>
    );
  }

  return (
    <div className={styles.selector}>
      <fieldset>
        <legend>{copy.color}</legend>
        <div className={styles.optionList}>
          {colors.map((color) => {
            const isAvailable = hasSelectableColor(variants, color);

            return (
              <button
                aria-label={`${copy.color} ${color} ${productName}${
                  isAvailable ? "" : `, ${copy.outOfStock}`
                }`}
                aria-pressed={color === selectedColor}
                className={color === selectedColor ? styles.selectedOption : undefined}
                disabled={!isAvailable}
                key={color}
                onClick={() => onColorChange(color)}
                type="button"
              >
                {color}
              </button>
            );
          })}
        </div>
      </fieldset>

      {requiresSize ? (
        <fieldset>
          <legend>{copy.size}</legend>
          <div className={styles.optionList}>
            {sizes.map((size) => {
              const isAvailable = Boolean(
                selectedColor &&
                  hasSelectableCombination(variants, selectedColor, size),
              );

              return (
                <button
                  aria-label={`${copy.size} ${size} ${productName}${
                    isAvailable ? "" : `, ${copy.outOfStock}`
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
        <p className={styles.selectionHint}>{copy.noSize}</p>
      )}

      {selectedVariant ? (
        <p className={styles.selectionStatus} role="status">
          {copy.selected}: {selectedVariant.color}
          {requiresSize ? ` / ${selectedVariant.size}` : ""}
        </p>
      ) : null}
    </div>
  );
}
