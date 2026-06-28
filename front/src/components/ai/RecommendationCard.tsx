"use client";

import { ArrowUpRight, ImageOff, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "@/components/ai/ProductRecommendations.module.css";
import { formatPrice } from "@/features/catalog/format";
import type { ProductRecommendation } from "@/features/ai/recommendationTypes";

export function RecommendationCard({
  recommendation,
}: {
  recommendation: ProductRecommendation;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const productPath = `/products/${encodeURIComponent(recommendation.productSlug)}`;

  return (
    <article className={styles.productCard}>
      <div className={styles.productImageWrap}>
        {recommendation.imageUrl && !imageFailed ? (
          <img
            alt={recommendation.productName}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={recommendation.imageUrl}
          />
        ) : (
          <div className={styles.imageFallback}>
            <ImageOff aria-hidden="true" size={28} strokeWidth={1.4} />
            <span>Image unavailable</span>
          </div>
        )}
        <span className={styles.stockBadge}>In stock</span>
      </div>

      <div className={styles.productBody}>
        <div className={styles.productHeading}>
          <h3>{recommendation.productName}</h3>
          <strong>{formatPrice(recommendation.price)}</strong>
        </div>
        <p className={styles.reason}>{recommendation.reason}</p>

        <dl className={styles.productMeta}>
          <div>
            <dt>Colors</dt>
            <dd>{formatOptions(recommendation.availableColors)}</dd>
          </div>
          <div>
            <dt>Sizes</dt>
            <dd>{formatOptions(recommendation.availableSizes)}</dd>
          </div>
        </dl>

        <div className={styles.productActions}>
          <Link className={styles.viewLink} href={productPath}>
            View Product
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
          <Link
            aria-label={`Choose a variant and add ${recommendation.productName} to cart`}
            className={styles.cartLink}
            href={`${productPath}#variants-heading`}
          >
            <ShoppingBag aria-hidden="true" size={15} />
            Add to Cart
          </Link>
        </div>
      </div>
    </article>
  );
}

function formatOptions(options: string[]): string {
  if (!options.length) return "See product";
  const shown = options.slice(0, 4);
  return `${shown.join(", ")}${options.length > shown.length ? ` +${options.length - shown.length}` : ""}`;
}
