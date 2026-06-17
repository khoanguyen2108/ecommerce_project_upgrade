"use client";

import { AlertCircle, PackageOpen, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { formatPrice } from "@/features/catalog/format";
import {
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/features/cart/api";
import {
  getCartErrorMessage,
  getCartRequestId,
} from "@/features/cart/errors";
import type { Cart } from "@/features/cart/types";

type CartAction =
  | { id: string; type: "item" }
  | { type: "clear" }
  | { type: "refresh" };

export function CartPage() {
  const [cart, setCart] = useState<Cart>();
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<CartAction>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadCart() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response = await getCart();

        if (isMounted) {
          setCart(response.cart);
        }
      } catch (loadError) {
        if (isMounted) {
          setCart(undefined);
          setError(getCartErrorMessage(loadError, "Cart could not be loaded."));
          setRequestId(getCartRequestId(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setAction(undefined);
        }
      }
    }

    void loadCart();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  async function handleUpdate(itemId: string, quantity: number) {
    setAction({ id: itemId, type: "item" });
    setError(undefined);
    setRequestId(undefined);

    try {
      const response = await updateCartItem(itemId, { quantity });
      setCart(response.cart);
    } catch (updateError) {
      setError(getCartErrorMessage(updateError, "Cart item could not be updated."));
      setRequestId(getCartRequestId(updateError));
    } finally {
      setAction(undefined);
    }
  }

  async function handleRemove(itemId: string) {
    setAction({ id: itemId, type: "item" });
    setError(undefined);
    setRequestId(undefined);

    try {
      const response = await removeCartItem(itemId);
      setCart(response.cart);
    } catch (removeError) {
      setError(getCartErrorMessage(removeError, "Cart item could not be removed."));
      setRequestId(getCartRequestId(removeError));
    } finally {
      setAction(undefined);
    }
  }

  async function handleClear() {
    setAction({ type: "clear" });
    setError(undefined);
    setRequestId(undefined);

    try {
      const response = await clearCart();
      setCart(response.cart);
    } catch (clearError) {
      setError(getCartErrorMessage(clearError, "Cart could not be cleared."));
      setRequestId(getCartRequestId(clearError));
    } finally {
      setAction(undefined);
    }
  }

  const hasItems = Boolean(cart && cart.items.length > 0);
  const isActionBusy = Boolean(action);

  return (
    <main className="customer-page cart-page">
      <section className="customer-hero" aria-labelledby="cart-heading">
        <div>
          <p className="eyebrow">Shopping cart</p>
          <h1 id="cart-heading">Cart</h1>
          <p>Review saved items before creating a pending-payment order.</p>
        </div>
        <div className="customer-toolbar__actions">
          <button
            className="button button--secondary"
            disabled={isLoading || isActionBusy}
            onClick={() => {
              setAction({ type: "refresh" });
              setRefreshKey((current) => current + 1);
            }}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isLoading || action?.type === "refresh" ? "spin" : undefined}
              size={17}
            />
            Refresh
          </button>
          <button
            className="button button--secondary"
            disabled={!hasItems || isLoading || isActionBusy}
            onClick={handleClear}
            type="button"
          >
            <Trash2 aria-hidden="true" size={17} />
            Clear
          </button>
        </div>
      </section>

      {error ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>{error}</span>
          {requestId ? <small>Request {requestId}</small> : null}
        </div>
      ) : null}

      {isLoading && !cart ? <CartSkeleton /> : null}

      {!isLoading && cart && cart.items.length === 0 ? <CartEmptyState /> : null}

      {cart && cart.items.length > 0 ? (
        <section className="cart-shell" aria-label="Cart items and totals">
          <div className="cart-items">
            <div className="customer-section__header">
              <div>
                <p className="eyebrow">Items</p>
                <h2>Current cart</h2>
              </div>
              <span>{cart.totalQuantity} total quantity</span>
            </div>

            <div className="cart-item-list">
              {cart.items.map((item) => (
                <CartItemRow
                  isBusy={
                    isActionBusy &&
                    (action?.type === "item" ? action.id === item.id : true)
                  }
                  item={item}
                  key={item.id}
                  onRemove={handleRemove}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          </div>

          <aside className="cart-summary-panel" aria-labelledby="cart-summary-heading">
            <p className="eyebrow">Estimated total</p>
            <h2 id="cart-summary-heading">{formatPrice(cart.estimatedSubtotal)}</h2>
            <dl className="order-summary-list">
              <div>
                <dt>Items</dt>
                <dd>{cart.items.length}</dd>
              </div>
              <div>
                <dt>Total quantity</dt>
                <dd>{cart.totalQuantity}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPrice(cart.estimatedSubtotal)}</dd>
              </div>
            </dl>
            <Link className="button button--primary button--full" href="/checkout">
              <ShoppingBag aria-hidden="true" size={17} />
              Proceed to checkout
            </Link>
            <Link className="button button--secondary button--full" href="/products">
              Continue shopping
            </Link>
          </aside>
        </section>
      ) : null}
    </main>
  );
}

function CartEmptyState() {
  return (
    <section className="wishlist-empty" aria-labelledby="cart-empty-heading">
      <PackageOpen aria-hidden="true" size={38} strokeWidth={1.6} />
      <h2 id="cart-empty-heading">Your cart is empty</h2>
      <p>Add a size and color from product details before checkout.</p>
      <Link className="button button--primary" href="/products">
        Browse products
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
