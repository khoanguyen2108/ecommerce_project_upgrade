interface ProductImageSource {
  imageUrls?: unknown;
}

export function getFirstProductImage(
  product: ProductImageSource | null | undefined,
): string | null {
  if (!Array.isArray(product?.imageUrls)) {
    return null;
  }

  for (const imageUrl of product.imageUrls) {
    if (typeof imageUrl !== 'string') {
      continue;
    }

    const normalizedImageUrl = imageUrl.trim();

    if (normalizedImageUrl) {
      return normalizedImageUrl;
    }
  }

  return null;
}
