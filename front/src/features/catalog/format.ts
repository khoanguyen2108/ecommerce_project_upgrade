export function formatPrice(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function getVariantSummary(variants: { color: string; size: string }[]): string {
  const colors = Array.from(new Set(variants.map((variant) => variant.color))).slice(0, 3);
  const sizes = Array.from(new Set(variants.map((variant) => variant.size))).slice(0, 4);

  if (colors.length === 0 && sizes.length === 0) {
    return "Variants coming soon";
  }

  return [colors.join(" / "), sizes.join(", ")].filter(Boolean).join(" - ");
}
