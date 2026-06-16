"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { formatPrice } from "@/features/catalog/format";
import type { RecentlyViewedProduct } from "@/features/recently-viewed/types";
import { useRecentlyViewed } from "@/features/recently-viewed/useRecentlyViewed";

interface RecentlyViewedProductsProps {
  excludeProductId?: string;
  limit?: number;
}

export function RecentlyViewedProducts({
  excludeProductId,
  limit = 4,
}: RecentlyViewedProductsProps) {
  const headingId = useId();
  const { isLoaded, items } = useRecentlyViewed();
  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => item.id !== excludeProductId)
        .slice(0, Math.max(0, limit)),
    [excludeProductId, items, limit],
  );

  if (!isLoaded || visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="recently-viewed-section" aria-labelledby={headingId}>
      <div className="recently-viewed-section__header">
        <div>
          <p className="eyebrow">On this device</p>
          <h2 id={headingId}>Recently viewed</h2>
          <p>Saved locally in this browser only.</p>
        </div>
        <span>
          {visibleItems.length === 1
            ? "1 product"
            : `${visibleItems.length} products`}
        </span>
      </div>

      <div className="product-grid recently-viewed-grid">
        {visibleItems.map((item) => (
          <RecentlyViewedProductCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function RecentlyViewedProductCard({
  item,
}: {
  item: RecentlyViewedProduct;
}) {
  const productHref = `/products/${encodeURIComponent(item.slug)}`;

  return (
    <article className="product-card recently-viewed-card">
      <Link href={productHref} aria-label={`View ${item.name}`}>
        <div className="product-card__image-wrap">
          {item.imageUrl ? (
            <img
              alt={item.name}
              className="product-card__image"
              loading="lazy"
              src={item.imageUrl}
            />
          ) : (
            <div className="product-card__placeholder">No image available</div>
          )}
        </div>
        <div className="product-card__body">
          {item.categoryName ? (
            <p className="product-card__category">{item.categoryName}</p>
          ) : null}
          <h3>{item.name}</h3>
          <p className="product-card__price">{formatPrice(item.price)}</p>
        </div>
      </Link>
    </article>
  );
}
