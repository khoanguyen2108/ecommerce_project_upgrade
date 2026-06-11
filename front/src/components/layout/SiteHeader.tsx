import { Heart, ShoppingBag, User } from "lucide-react";
import Link from "next/link";

interface SiteHeaderProps {
  active?: "shop" | "account";
}

export function SiteHeader({ active }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand-mark" href="/" aria-label="Belikeme home">
          BELIKEME
        </Link>

        <nav aria-label="Primary navigation" className="site-nav">
          <Link className={active === "shop" ? "is-active" : undefined} href="/">
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
            title="Wishlist will be available with the catalog flow"
            type="button"
          >
            <Heart size={20} strokeWidth={1.8} />
          </button>
          <button
            aria-label="Cart preview"
            className="icon-button"
            title="Cart will be available with the catalog flow"
            type="button"
          >
            <ShoppingBag size={20} strokeWidth={1.8} />
          </button>
          <Link
            aria-label="Account"
            className={`icon-button ${active === "account" ? "is-active" : ""}`}
            href="/login"
            title="Account"
          >
            <User size={20} strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </header>
  );
}
