"use client";

import Link from "next/link";
import { useState } from "react";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { formatPrice, getVariantSummary } from "@/features/catalog/format";
import type { Product } from "@/features/catalog/types";
import { productToWishlistItem } from "@/features/wishlist/useWishlist";

interface ProductCardProps {
  product: Product;
  variant?: "default" | "shop";
}

export function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const imageUrl = product.imageUrls[0];
  const categories = product.categories?.length
    ? product.categories
    : [product.category];
  const [imageFailed, setImageFailed] = useState(false);
  const wishlistItem = productToWishlistItem(product);
  const activeVariants = product.variants.filter((item) => item.isActive);
  const availableStock = activeVariants.reduce(
    (total, item) => total + Math.max(0, item.stock),
    0,
  );
  const availability =
    activeVariants.length === 0
      ? "Availability pending"
      : availableStock > 0
        ? "In stock"
        : "Sold out";

  return (
    <article
      className={`product-card ${variant === "shop" ? "product-card--shop" : ""}`}
    >
      <WishlistButton
        className="product-card__wishlist"
        item={wishlistItem}
        variant="icon"
      />
      <Link href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        <div className="product-card__image-wrap">
          {imageUrl && !imageFailed ? (
            <img
              alt={product.name}
              className="product-card__image"
              loading="lazy"
              onError={() => setImageFailed(true)}
              src={imageUrl}
            />
          ) : (
            <div className="product-card__placeholder">No image available</div>
          )}
        </div>
        <div className="product-card__body">
          <p className="product-card__category">
            {categories[0].name}
            {categories.length > 1 ? <span>+{categories.length - 1}</span> : null}
          </p>
          <h3>{product.name}</h3>
          <div className="product-card__price-row">
            <p className="product-card__price">{formatPrice(product.basePrice)}</p>
            {variant === "shop" ? (
              <p className="product-card__availability">{availability}</p>
            ) : null}
          </div>
          <p className="product-card__meta">{getVariantSummary(product.variants)}</p>
        </div>
      </Link>
    </article>
  );
}
