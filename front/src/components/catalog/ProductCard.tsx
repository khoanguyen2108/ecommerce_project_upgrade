"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/features/catalog/format";
import type { Product } from "@/features/catalog/types";

interface ProductCardProps {
  product: Product;
  variant?: "default" | "shop";
}

export function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const imageUrl = product.imageUrls[0];
  const productName = (product.name ?? "");
  const [imageFailed, setImageFailed] = useState(false);
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
      <Link
        href={`/products/${product.slug}`}
        aria-label={`${"View product"}: ${productName}`}
      >
        <div className="product-card__image-wrap">
          {imageUrl && !imageFailed ? (
            <img
              alt={productName}
              className="product-card__image"
              loading="lazy"
              onError={() => setImageFailed(true)}
              src={imageUrl}
            />
          ) : (
            <div className="product-card__placeholder">{"No image available"}</div>
          )}
        </div>
        <div className="product-card__body">
          <h3>{productName}</h3>
          <div className="product-card__price-row">
            <p className="product-card__price">{formatPrice(product.basePrice)}</p>
            {variant === "shop" ? (
              <p className="product-card__availability">{availability}</p>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
