"use client";

import { AlertCircle, PackageOpen, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { useCart } from "@/components/cart/CartProvider";
import { formatPrice } from "@/features/catalog/format";
import { useI18n } from "@/features/i18n/useI18n";

export function CartPage() {
  const { t } = useI18n();
  const {
    cart,
    clearCart,
    error,
    isLoading,
    isSaving,
    refreshCart,
    removeItem,
    requestId,
    updateQuantity,
  } = useCart();

  const hasItems = Boolean(cart && cart.items.length > 0);

  return (
    <main className="customer-page cart-page">
      {error ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>{error}</span>
          {requestId ? <small>Request {requestId}</small> : null}
        </div>
      ) : null}

      {!cart && (isLoading || !error) ? <CartSkeleton /> : null}

      {!isLoading && cart && cart.items.length === 0 ? <CartEmptyState /> : null}

      {cart && cart.items.length > 0 ? (
        <section className="cart-shell" aria-label={t("nav.cart")}>
          <div className="cart-items">
            <div className="customer-section__header">
              <div>
                <p className="eyebrow">{t("cart.items")}</p>
                <h2>{t("cart.currentCart")}</h2>
              </div>
              <div className="customer-toolbar__actions">
                <span>{cart.totalQuantity} {t("cart.totalQuantity")}</span>
                <button
                  className="button button--secondary"
                  disabled={isLoading || isSaving}
                  onClick={() => void refreshCart().catch(() => undefined)}
                  type="button"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={isLoading ? "spin" : undefined}
                    size={17}
                  />
                  {t("cart.refresh")}
                </button>
                <button
                  className="button button--secondary"
                  disabled={!hasItems || isLoading || isSaving}
                  onClick={() => void clearCart().catch(() => undefined)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={17} />
                  {t("cart.clear")}
                </button>
              </div>
            </div>

            <div className="cart-item-list">
              {cart.items.map((item) => (
                <CartItemRow
                  isBusy={
                    isSaving
                  }
                  item={item}
                  key={item.id}
                  onRemove={(id) => void removeItem(id).catch(() => undefined)}
                  onUpdate={(id, quantity) =>
                    void updateQuantity(id, quantity).catch(() => undefined)
                  }
                />
              ))}
            </div>
          </div>

          <aside className="cart-summary-panel" aria-labelledby="cart-summary-heading">
            <p className="eyebrow">{t("cart.estimatedTotal")}</p>
            <h2 id="cart-summary-heading">{formatPrice(cart.estimatedSubtotal)}</h2>
            <dl className="order-summary-list">
              <div>
                <dt>{t("cart.items")}</dt>
                <dd>{cart.items.length}</dd>
              </div>
              <div>
                <dt>{t("cart.totalQuantity")}</dt>
                <dd>{cart.totalQuantity}</dd>
              </div>
              <div>
                <dt>{t("cart.subtotal")}</dt>
                <dd>{formatPrice(cart.estimatedSubtotal)}</dd>
              </div>
            </dl>
            <Link className="button button--primary button--full" href="/checkout">
              <ShoppingBag aria-hidden="true" size={17} />
              {t("cart.proceedCheckout")}
            </Link>
            <Link className="button button--secondary button--full" href="/products">
              {t("cart.continueShopping")}
            </Link>
          </aside>
        </section>
      ) : null}
    </main>
  );
}

function CartEmptyState() {
  const { t } = useI18n();

  return (
    <section className="checkout-empty" aria-labelledby="cart-empty-heading">
      <PackageOpen aria-hidden="true" size={38} strokeWidth={1.6} />
      <h2 id="cart-empty-heading">{t("cart.emptyTitle")}</h2>
      <p>{t("cart.emptyDetail")}</p>
      <Link className="button button--primary" href="/products">
        {t("cart.browseProducts")}
      </Link>
    </section>
  );
}

function CartSkeleton() {
  return (
    <section className="cart-shell" aria-busy="true" aria-live="polite">
      <div className="cart-items">
        <div className="customer-section__header">
          <span className="customer-skeleton-line customer-skeleton-line--wide" />
          <span className="customer-skeleton-line" />
        </div>
        <div className="cart-item-list">
          {Array.from({ length: 3 }, (_, index) => (
            <div aria-hidden="true" className="cart-item-row" key={index}>
              <span className="cart-item-row__image cart-item-row__image--skeleton" />
              <span className="cart-item-row__body">
                <span className="customer-skeleton-line" />
                <span className="customer-skeleton-line customer-skeleton-line--wide" />
                <span className="customer-skeleton-line" />
              </span>
            </div>
          ))}
        </div>
      </div>
      <aside className="cart-summary-panel">
        <span className="customer-skeleton-line" />
        <span className="customer-skeleton-line customer-skeleton-line--wide" />
      </aside>
    </section>
  );
}
