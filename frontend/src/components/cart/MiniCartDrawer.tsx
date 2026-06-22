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
import type { CartItem } from "@/features/cart/types";

export function MiniCartDrawer() {
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
            <h2 id="mini-cart-heading">Cart</h2>
            <p>
              {cartCount} {cartCount === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            aria-label="Close cart"
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
                Retry
              </button>
            </div>
          ) : null}

          {isLoading && !cart ? (
            <div className="mini-cart-state" role="status">
              <Loader2 aria-hidden="true" className="spin" size={26} />
              <p>Loading cart...</p>
            </div>
          ) : null}

          {!isLoading && !error && !hasItems ? (
            <div className="mini-cart-state">
              <PackageOpen aria-hidden="true" size={34} strokeWidth={1.5} />
              <h3>Your cart is empty</h3>
              <p>Choose a size and color to get started.</p>
              <Link
                className="button button--primary"
                href="/products"
                onClick={closeCart}
              >
                Continue shopping
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
              <span>Subtotal</span>
              <strong>{formatPrice(cart.estimatedSubtotal)}</strong>
            </div>
            <p>Taxes and delivery are calculated at checkout.</p>
            <div className="mini-cart-actions">
              <Link
                className="button button--primary button--full"
                href="/checkout"
                onClick={closeCart}
              >
                Checkout
              </Link>
              <Link
                className="button button--secondary button--full"
                href="/cart"
                onClick={closeCart}
              >
                View cart
              </Link>
              <button className="text-link" onClick={closeCart} type="button">
                Continue shopping
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
  const maxQuantity = Math.max(1, Math.min(99, item.availableStock));
  const productHref = `/products/${encodeURIComponent(item.product.slug)}`;

  return (
    <article className="mini-cart-item">
      <Link
        aria-label={`View ${item.product.name}`}
        className="mini-cart-item__image"
        href={productHref}
        onClick={onClose}
      >
        {item.product.firstImageUrl ? (
          <img alt={item.product.name} src={item.product.firstImageUrl} />
        ) : (
          <span>No image</span>
        )}
      </Link>
      <div className="mini-cart-item__copy">
        <Link href={productHref} onClick={onClose}>
          {item.product.name}
        </Link>
        <p>
          {item.variant.size} / {item.variant.color}
        </p>
        <span>{formatPrice(item.currentUnitPrice)}</span>
        <div className="mini-cart-item__controls">
          <div className="mini-cart-stepper" aria-label="Quantity controls">
            <button
              aria-label={`Decrease ${item.product.name} quantity`}
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
              aria-label={`Increase ${item.product.name} quantity`}
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
            aria-label={`Remove ${item.product.name} from cart`}
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
