"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AdminTopProduct } from "@/features/admin-stats/types";
import { formatAdminSoldCount } from "@/components/admin/admin-format";

interface TopProductsCardProps {
  isLoading: boolean;
  isUnavailable: boolean;
  onRetry: () => void;
  products?: AdminTopProduct[];
}

export function TopProductsCard({
  isLoading,
  isUnavailable,
  onRetry,
  products,
}: TopProductsCardProps) {

  return (
    <section className="admin-dashboard-card admin-dashboard-top-products" aria-labelledby="top-products-heading">
      <header className="admin-dashboard-card__header">
        <div>
          <p className="admin-dashboard-card__kicker">
            {"Paid sales"}
          </p>
          <h2 id="top-products-heading">{"Top Products"}</h2>
        </div>
        <Link href="/admin/products">{"View All"}</Link>
      </header>

      <div className="admin-dashboard-top-products__list">
        {isLoading ? <TopProductsSkeleton /> : null}
        {!isLoading && isUnavailable ? (
          <div className="admin-dashboard-top-products__state">
            <span>{"Top products are temporarily unavailable."}</span>
            <button onClick={onRetry} type="button">
              {"Retry"}
            </button>
          </div>
        ) : null}
        {!isLoading && !isUnavailable && products?.length === 0 ? (
          <div className="admin-dashboard-top-products__state">
            {"No paid product sales yet"}
          </div>
        ) : null}
        {!isLoading && !isUnavailable
          ? products?.map((product) => (
              <article className="admin-dashboard-top-product" key={product.productId}>
                <ProductThumbnail product={product} />
                <div className="admin-dashboard-top-product__details">
                  <strong>{(product.name ?? "")}</strong>
                  <small>
                    {product.categoryName
                      ? (product.categoryName ?? "")
                      : "Uncategorized"}
                  </small>
                </div>
                <span>{formatAdminSoldCount(product.soldQuantity)}</span>
              </article>
            ))
          : null}
      </div>
    </section>
  );
}

function ProductThumbnail({ product }: { product: AdminTopProduct }) {
  const [hasImageError, setHasImageError] = useState(false);

  return (
    <span className="admin-dashboard-top-product__thumbnail">
      {product.imageUrl && !hasImageError ? (
        // The API can return external catalog image URLs, so a native image keeps
        // the dashboard compatible with every configured image host.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" onError={() => setHasImageError(true)} src={product.imageUrl} />
      ) : (
        <ImageIcon aria-hidden="true" size={18} strokeWidth={1.5} />
      )}
    </span>
  );
}

function TopProductsSkeleton() {

  return (
    <div
      aria-label={"Loading top products"}
      className="admin-dashboard-top-products__skeleton"
      role="status"
    >
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row}>
          <span className="admin-dashboard-skeleton" />
          <span className="admin-dashboard-skeleton" />
          <span className="admin-dashboard-skeleton" />
        </div>
      ))}
    </div>
  );
}
