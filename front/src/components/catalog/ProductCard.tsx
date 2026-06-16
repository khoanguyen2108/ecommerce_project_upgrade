"use client";

import Link from "next/link";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { formatPrice, getVariantSummary } from "@/features/catalog/format";
import type { Product } from "@/features/catalog/types";
import { productToWishlistItem } from "@/features/wishlist/useWishlist";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl = product.imageUrls[0];
  const wishlistItem = productToWishlistItem(product);

  return (
    <article className="product-card">
      <WishlistButton
        className="product-card__wishlist"
        item={wishlistItem}
        variant="icon"
      />
      <Link href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        <div className="product-card__image-wrap">
          {imageUrl ? (
            <img
              alt={product.name}
              className="product-card__image"
              loading="lazy"
              src={imageUrl}
            />
          ) : (
            <div className="product-card__placeholder">No image available</div>
          )}
        </div>
        <div className="product-card__body">
          <p className="product-card__category">{product.category.name}</p>
          <h3>{product.name}</h3>
          <p className="product-card__price">{formatPrice(product.basePrice)}</p>
          <p className="product-card__meta">{getVariantSummary(product.variants)}</p>
        </div>
      </Link>
    </article>
  );
}
