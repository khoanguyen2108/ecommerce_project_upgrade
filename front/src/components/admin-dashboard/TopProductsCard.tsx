"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AdminTopProduct } from "@/features/admin-stats/types";
import {
  localizeCategoryName,
  localizeProductName,
} from "@/features/catalog/localization";
import {
  formatAdminSoldCount,
  useAdminCommonI18n,
} from "@/features/i18n/admin-common-translations";

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
  const { locale, messages } = useAdminCommonI18n();

  return (
    <section className="admin-dashboard-card admin-dashboard-top-products" aria-labelledby="top-products-heading">
      <header className="admin-dashboard-card__header">
        <div>
          <p className="admin-dashboard-card__kicker">
            {messages.dashboard.paidSales}
          </p>
          <h2 id="top-products-heading">{messages.dashboard.topProducts}</h2>
        </div>
        <Link href="/admin/products">{messages.dashboard.viewAll}</Link>
      </header>

      <div className="admin-dashboard-top-products__list">
        {isLoading ? <TopProductsSkeleton /> : null}
        {!isLoading && isUnavailable ? (
          <div className="admin-dashboard-top-products__state">
            <span>{messages.dashboard.topProductsUnavailable}</span>
            <button onClick={onRetry} type="button">
              {messages.common.retry}
            </button>
          </div>
        ) : null}
        {!isLoading && !isUnavailable && products?.length === 0 ? (
          <div className="admin-dashboard-top-products__state">
            {messages.dashboard.noPaidProductSales}
          </div>
        ) : null}
        {!isLoading && !isUnavailable
          ? products?.map((product) => (
              <article className="admin-dashboard-top-product" key={product.productId}>
                <ProductThumbnail product={product} />
                <div className="admin-dashboard-top-product__details">
                  <strong>{localizeProductName(product.name, locale)}</strong>
                  <small>
                    {product.categoryName
                      ? localizeCategoryName(product.categoryName, locale)
                      : messages.dashboard.uncategorized}
                  </small>
                </div>
                <span>{formatAdminSoldCount(locale, product.soldQuantity)}</span>
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
  const { messages } = useAdminCommonI18n();

  return (
    <div
      aria-label={messages.dashboard.loadingTopProducts}
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
