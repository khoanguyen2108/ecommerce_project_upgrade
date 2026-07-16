"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/features/catalog/format";
import type { Product } from "@/features/catalog/types";
import { useI18n } from "@/features/i18n/useI18n";

interface ProductCardProps {
  product: Product;
  variant?: "default" | "shop";
}

export function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const { t } = useI18n();
  const imageUrl = product.imageUrls[0];
  const [imageFailed, setImageFailed] = useState(false);
  const activeVariants = product.variants.filter((item) => item.isActive);
  const availableStock = activeVariants.reduce(
    (total, item) => total + Math.max(0, item.stock),
    0,
  );
  const availability =
    activeVariants.length === 0
      ? t("product.availabilityPending")
      : availableStock > 0
        ? t("product.inStock")
        : t("product.soldOut");

  return (
    <article
      className={`product-card ${variant === "shop" ? "product-card--shop" : ""}`}
    >
      <Link
        href={`/products/${product.slug}`}
        aria-label={`${t("product.view")}: ${product.name}`}
      >
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
            <div className="product-card__placeholder">{t("common.noImage")}</div>
          )}
        </div>
        <div className="product-card__body">
          <h3>{product.name}</h3>
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
