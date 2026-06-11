"use client";

import { Heart, LogOut, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";

interface SiteHeaderProps {
  active?: "shop" | "account";
}

export function SiteHeader({ active }: SiteHeaderProps) {
  const { isAuthenticated, isLoading, logout } = useAuthSession();

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
          <Link href="/#categories">Categories</Link>
          <Link href="/#new-arrivals">New Arrivals</Link>
          <Link href="/#about">About</Link>
        </nav>

        <div className="site-actions">
          <button
            aria-label="Wishlist preview"
            className="icon-button"
            title="Wishlist is coming soon."
            type="button"
          >
            <Heart size={20} strokeWidth={1.8} />
          </button>
          <button
            aria-label="Cart preview"
            className="icon-button"
            title="Cart is coming soon."
            type="button"
          >
            <ShoppingBag size={20} strokeWidth={1.8} />
          </button>
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
          ) : (
            <Link
              aria-label="Account"
              className={`icon-button ${active === "account" ? "is-active" : ""}`}
              href="/login"
              title="Account"
            >
              <User size={20} strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
