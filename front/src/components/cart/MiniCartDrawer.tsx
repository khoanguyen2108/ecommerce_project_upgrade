"use client";

import {
  AlertCircle,
  Loader2,
  Minus,
  PackageOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatPrice } from "@/features/catalog/format";
import {
  localizeColorName,
  localizeProductName,
} from "@/features/catalog/localization";
import { isImplicitAccessoryOption } from "@/features/catalog/sizes";
import type { CartItem } from "@/features/cart/types";
import { useI18n } from "@/features/i18n/useI18n";

export function MiniCartDrawer() {
  const { t } = useI18n();
  const {
    cart,
    cartCount,
    closeCart,
    error,
    isLoading,
    isOpen,
    isSaving,
    refreshCart,
    removeItem,
    requestId,
    updateQuantity,
  } = useCart();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCart();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [closeCart, isOpen]);

  if (!isOpen) {
    return null;
  }

  const hasItems = Boolean(cart?.items.length);

  return (
    <div
      className="mini-cart-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeCart();
        }
      }}
    >
      <aside
        aria-labelledby="mini-cart-heading"
        aria-modal="true"
        className="mini-cart-drawer"
        role="dialog"
      >
        <header className="mini-cart-drawer__header">
          <div>
            <h2 id="mini-cart-heading">{t("nav.cart")}</h2>
            <p>
              {cartCount} {cartCount === 1 ? t("cart.item") : t("cart.items")}
            </p>
          </div>
          <button
            aria-label={t("cart.close")}
            className="icon-button mini-cart-drawer__close"
            onClick={closeCart}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={21} />
          </button>
        </header>

        <div className="mini-cart-drawer__body">
          {error ? (
            <div className="mini-cart-error" role="alert">
              <AlertCircle aria-hidden="true" size={19} />
              <span>{error}</span>
              {requestId ? <small>Request {requestId}</small> : null}
              <button
                className="button button--secondary"
                disabled={isLoading}
                onClick={() => void refreshCart().catch(() => undefined)}
                type="button"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : null}

          {isLoading && !cart ? (
            <div className="mini-cart-state" role="status">
              <Loader2 aria-hidden="true" className="spin" size={26} />
              <p>{t("cart.loading")}</p>
            </div>
          ) : null}

          {!isLoading && !error && !hasItems ? (
            <div className="mini-cart-state">
              <PackageOpen aria-hidden="true" size={34} strokeWidth={1.5} />
              <h3>{t("cart.emptyTitle")}</h3>
              <p>{t("cart.emptyBody")}</p>
              <Link
                className="button button--primary"
                href="/products"
                onClick={closeCart}
              >
                {t("cart.continueShopping")}
              </Link>
            </div>
          ) : null}

          {hasItems ? (
            <div aria-busy={isSaving} className="mini-cart-items">
              {cart?.items.map((item) => (
                <MiniCartItem
                  isSaving={isSaving}
                  item={item}
                  key={item.id}
                  onClose={closeCart}
                  onRemove={removeItem}
                  onUpdate={updateQuantity}
                />
              ))}
            </div>
          ) : null}
        </div>

        {hasItems && cart ? (
          <footer className="mini-cart-drawer__footer">
            <div className="mini-cart-subtotal">
              <span>{t("cart.subtotal")}</span>
              <strong>{formatPrice(cart.estimatedSubtotal)}</strong>
            </div>
            <p>{t("cart.taxes")}</p>
            <div className="mini-cart-actions">
              <Link
                className="button button--primary button--full"
                href="/checkout"
                onClick={closeCart}
              >
                {t("cart.checkout")}
              </Link>
              <Link
                className="button button--secondary button--full"
                href="/cart"
                onClick={closeCart}
              >
                {t("cart.viewCart")}
              </Link>
              <button className="text-link" onClick={closeCart} type="button">
                {t("cart.continueShopping")}
              </button>
            </div>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function MiniCartItem({
  isSaving,
  item,
  onClose,
  onRemove,
  onUpdate,
}: {
  isSaving: boolean;
  item: CartItem;
  onClose: () => void;
  onRemove: (id: string) => Promise<void>;
  onUpdate: (id: string, quantity: number) => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const maxQuantity = Math.max(1, Math.min(99, item.availableStock));
  const productHref = `/products/${encodeURIComponent(item.product.slug)}`;
  const showVariantOption = !isImplicitAccessoryOption(item.variant);
  const productName = localizeProductName(item.product.name, locale);

  return (
    <article className="mini-cart-item">
      <Link
        aria-label={`${t("product.view")}: ${productName}`}
        className="mini-cart-item__image"
        href={productHref}
        onClick={onClose}
      >
        {item.product.firstImageUrl ? (
          <img alt={productName} src={item.product.firstImageUrl} />
        ) : (
          <span>{t("cart.noImage")}</span>
        )}
      </Link>
      <div className="mini-cart-item__copy">
        <Link href={productHref} onClick={onClose}>
          {productName}
        </Link>
        {showVariantOption ? (
          <p>
            {item.variant.size} / {localizeColorName(item.variant.color, locale)}
          </p>
        ) : null}
        <span>{formatPrice(item.currentUnitPrice)}</span>
        <div className="mini-cart-item__controls">
          <div className="mini-cart-stepper" aria-label={t("cart.quantityControls")}>
            <button
              aria-label={`${t("product.decreaseQuantity")}: ${productName}`}
              disabled={isSaving || item.quantity <= 1}
              onClick={() =>
                void onUpdate(item.id, item.quantity - 1).catch(() => undefined)
              }
              type="button"
            >
              <Minus aria-hidden="true" size={14} />
            </button>
            <span aria-live="polite">{item.quantity}</span>
            <button
              aria-label={`${t("product.increaseQuantity")}: ${productName}`}
              disabled={
                isSaving || item.availableStock <= 0 || item.quantity >= maxQuantity
              }
              onClick={() =>
                void onUpdate(item.id, item.quantity + 1).catch(() => undefined)
              }
              type="button"
            >
              <Plus aria-hidden="true" size={14} />
            </button>
          </div>
          <button
            aria-label={`${t("common.remove")}: ${productName}`}
            className="mini-cart-item__remove"
            disabled={isSaving}
            onClick={() => void onRemove(item.id).catch(() => undefined)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
      <strong className="mini-cart-item__total">
        {formatPrice(item.currentLineTotal)}
      </strong>
    </article>
  );
}
