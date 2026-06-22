"use client";

import { HeartOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { RecentlyViewedProducts } from "@/components/recently-viewed/RecentlyViewedProducts";
import { formatPrice } from "@/features/catalog/format";
import type { WishlistItem } from "@/features/wishlist/types";
import { useWishlist } from "@/features/wishlist/useWishlist";

export function WishlistPage() {
  const { count, isLoaded, items, removeItem } = useWishlist();

  return (
    <main className="customer-page wishlist-page">
      <section className="customer-hero" aria-labelledby="wishlist-heading">
        <div>
          <p className="eyebrow">Local wishlist</p>
          <h1 id="wishlist-heading">Wishlist</h1>
          <p>
            Saved products stay on this device only. They are not synced to an
            account.
          </p>
        </div>
        <Link className="button button--secondary" href="/products">
          Continue shopping
        </Link>
      </section>

      {!isLoaded ? <WishlistSkeleton /> : null}

      {isLoaded && count === 0 ? <WishlistEmptyState /> : null}

      {isLoaded && count > 0 ? (
        <section className="wishlist-section" aria-label="Saved products">
          <div className="customer-section__header">
            <h2>Saved products</h2>
            <span>{count === 1 ? "1 item" : `${count} items`}</span>
          </div>

          <div className="wishlist-grid">
            {items.map((item) => (
              <WishlistListItem
                item={item}
                key={item.id}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <RecentlyViewedProducts />
    </main>
  );
}

function WishlistListItem({
  item,
  onRemove,
}: {
  item: WishlistItem;
  onRemove: () => void;
}) {
  const productHref = `/products/${encodeURIComponent(item.slug)}`;

  return (
    <article className="wishlist-item">
      <Link
        aria-label={`View ${item.name}`}
        className="wishlist-item__image"
        href={productHref}
      >
        {item.imageUrl ? (
          <img alt={item.name} loading="lazy" src={item.imageUrl} />
        ) : (
          <span>No image available</span>
        )}
      </Link>

      <div className="wishlist-item__body">
        {item.categoryName ? (
          <p className="wishlist-item__category">{item.categoryName}</p>
        ) : null}
        <h2>
          <Link href={productHref}>{item.name}</Link>
        </h2>
        <p className="wishlist-item__price">{formatPrice(item.price)}</p>
      </div>

      <button
        aria-label={`Remove ${item.name} from wishlist`}
        className="icon-button wishlist-item__remove"
        onClick={onRemove}
        title="Remove"
        type="button"
      >
        <Trash2 aria-hidden="true" size={18} strokeWidth={1.9} />
      </button>
    </article>
  );
}

function WishlistEmptyState() {
  return (
    <section className="wishlist-empty" aria-labelledby="wishlist-empty-heading">
      <HeartOff aria-hidden="true" size={38} strokeWidth={1.6} />
      <h2 id="wishlist-empty-heading">Your wishlist is empty</h2>
      <p>Save products from the catalog and they will appear here on this device.</p>
      <Link className="button button--primary" href="/products">
        Browse products
      </Link>
    </section>
  );
}

function WishlistSkeleton() {
  return (
    <section className="wishlist-section" aria-busy="true" aria-live="polite">
      <div className="customer-section__header">
        <span className="customer-skeleton-line customer-skeleton-line--wide" />
        <span className="customer-skeleton-line" />
      </div>
      <div className="wishlist-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div aria-hidden="true" className="wishlist-item" key={index}>
            <span className="wishlist-item__image wishlist-item__image--skeleton" />
            <span className="wishlist-item__body">
              <span className="customer-skeleton-line" />
              <span className="customer-skeleton-line customer-skeleton-line--wide" />
              <span className="customer-skeleton-line" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
