"use client";

import {
  Heart,
  LogOut,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  User,
} from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import { useWishlist } from "@/features/wishlist/useWishlist";

interface SiteHeaderProps {
  active?:
    | "shop"
    | "categories"
    | "account"
    | "cart"
    | "orders"
    | "wishlist"
    | "ai"
    | "ai-recommendations";
}

export function SiteHeader({ active }: SiteHeaderProps) {
  const { currentUser, isAuthenticated, isLoading, logout } = useAuthSession();
  const { cartCount, openCart } = useCart();
  const { count: wishlistCount, isLoaded: isWishlistLoaded } = useWishlist();
  const isAdmin = isAdminUser(currentUser);
  const showCustomerActions = !isLoading && !isAdmin;
  const wishlistLabel =
    isWishlistLoaded && wishlistCount > 0
      ? `Wishlist, ${wishlistCount} saved ${
          wishlistCount === 1 ? "item" : "items"
        }`
      : "Wishlist";
  const cartLabel =
    cartCount > 0
      ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
      : "Cart";

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand-mark" href="/" aria-label="Belikeme home">
          BELIKEME
        </Link>

        <nav aria-label="Primary navigation" className="site-nav">
          <Link
            className={active === "shop" ? "is-active" : undefined}
            href="/products"
          >
            Shop
          </Link>
          <Link
            className={active === "categories" ? "is-active" : undefined}
            href="/categories"
          >
            Categories
          </Link>
          <Link href="/#new-arrivals">New Arrivals</Link>
          {!isAdmin ? (
            <>
              <Link
                className={active === "ai" ? "is-active" : undefined}
                href="/ai/style-assistant"
              >
                AI Style Assistant
              </Link>
              <Link
                className={active === "ai-recommendations" ? "is-active" : undefined}
                href="/ai/recommendations"
              >
                AI Recommendations
              </Link>
            </>
          ) : null}
          <Link href="/#about">About</Link>
        </nav>

        <div className="site-actions">
          {showCustomerActions ? (
            <Link
              aria-label={wishlistLabel}
              className={`icon-button ${active === "wishlist" ? "is-active" : ""}`}
              href="/wishlist"
              title="Wishlist"
            >
              <Heart size={20} strokeWidth={1.8} />
              {isWishlistLoaded && wishlistCount > 0 ? (
                <span className="icon-button__badge">{wishlistCount}</span>
              ) : null}
            </Link>
          ) : null}
          {showCustomerActions ? (
            isAuthenticated ? (
              <button
                aria-label={cartLabel}
                className={`icon-button ${active === "cart" ? "is-active" : ""}`}
                onClick={openCart}
                title="Cart"
                type="button"
              >
                <ShoppingBag size={20} strokeWidth={1.8} />
                {cartCount > 0 ? (
                  <span className="icon-button__badge">{cartCount}</span>
                ) : null}
              </button>
            ) : (
              <Link
                aria-label="Cart"
                className={`icon-button ${active === "cart" ? "is-active" : ""}`}
                href="/cart"
                title="Cart"
              >
                <ShoppingBag size={20} strokeWidth={1.8} />
              </Link>
            )
          ) : null}
          {showCustomerActions && isAuthenticated ? (
            <>
              <Link
                aria-label="Profile"
                className={`icon-button ${
                  active === "account" ? "is-active" : ""
                }`}
                href="/profile"
                title="Profile"
              >
                <User size={20} strokeWidth={1.8} />
              </Link>
              <Link
                aria-label="Orders"
                className={`icon-button ${active === "orders" ? "is-active" : ""}`}
                href="/orders"
                title="Orders"
              >
                <ReceiptText size={20} strokeWidth={1.8} />
              </Link>
            </>
          ) : null}
          {showCustomerActions && !isAuthenticated ? (
            <Link
              aria-label="Account"
              className={`icon-button ${active === "account" ? "is-active" : ""}`}
              href="/login"
              title="Account"
            >
              <User size={20} strokeWidth={1.8} />
            </Link>
          ) : null}
          {isAuthenticated ? (
            <button
              aria-label="Sign out"
              className="icon-button"
              disabled={isLoading}
              onClick={() => void logout()}
              title="Sign out"
              type="button"
            >
              <LogOut size={20} strokeWidth={1.8} />
            </button>
          ) : null}
          {!isLoading && isAdmin ? (
            <Link
              aria-label="Admin"
              className="icon-button"
              href="/admin"
              title="Admin"
            >
              <ShieldCheck size={20} strokeWidth={1.8} />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
