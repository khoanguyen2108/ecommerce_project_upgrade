"use client";

import {
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";

type SiteHeaderActive =
  | "shop"
  | "categories"
  | "account"
  | "cart"
  | "orders"
  | "ai";

interface SiteHeaderProps {
  active?: SiteHeaderActive;
}

type PrimaryNavItem = {
  active?: SiteHeaderActive;
  hideForAdmin?: boolean;
  href: string;
  label: string;
};

const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { active: "shop", href: "/products", label: "Shop" },
  { active: "categories", href: "/categories", label: "Categories" },
  {
    active: "ai",
    hideForAdmin: true,
    href: "/ai/style-assistant",
    label: "AI Style Assistant",
  },
  { href: "/#about", label: "About" },
];

export function SiteHeader({ active }: SiteHeaderProps) {
  const { currentUser, isAuthenticated, isLoading, logout } = useAuthSession();
  const { cartCount, openCart } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isAdmin = isAdminUser(currentUser);
  const showCustomerActions = !isLoading && !isAdmin;
  const primaryNavItems = PRIMARY_NAV_ITEMS.filter(
    (item) => !(item.hideForAdmin && isAdmin),
  );
  const cartLabel =
    cartCount > 0
      ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
      : "Cart";
  const mobileMenuId = "site-mobile-navigation";

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 981px)");

    function handleViewportChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setIsMobileMenuOpen(false);
      }
    }

    if (mediaQuery.matches) {
      setIsMobileMenuOpen(false);
      return;
    }

    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, [isMobileMenuOpen]);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button
          aria-controls={mobileMenuId}
          aria-expanded={isMobileMenuOpen}
          aria-label={
            isMobileMenuOpen
              ? "Close primary navigation"
              : "Open primary navigation"
          }
          className="icon-button site-menu-button"
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
          type="button"
        >
          {isMobileMenuOpen ? (
            <X aria-hidden="true" size={25} strokeWidth={2} />
          ) : (
            <Menu aria-hidden="true" size={28} strokeWidth={2} />
          )}
        </button>

        <nav aria-label="Primary navigation" className="site-nav">
          {primaryNavItems.map((item) => {
            const isActive = Boolean(item.active && active === item.active);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "is-active" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link className="brand-mark" href="/" aria-label="Belikeme home">
          BELIKEME
        </Link>

        <div className="site-actions">
          {showCustomerActions && isAuthenticated ? (
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
          ) : null}
          {showCustomerActions && isAuthenticated ? (
            <>
              <Link
                aria-label="Orders"
                className={`icon-button ${active === "orders" ? "is-active" : ""}`}
                href="/orders"
                title="Orders"
              >
                <ReceiptText size={20} strokeWidth={1.8} />
              </Link>
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

      {isMobileMenuOpen ? (
        <div
          className="site-mobile-nav-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMobileMenu();
            }
          }}
        >
          <aside
            aria-labelledby="site-mobile-nav-heading"
            aria-modal="true"
            className="site-mobile-nav"
            id={mobileMenuId}
            role="dialog"
          >
            <header className="site-mobile-nav__header">
              <h2 id="site-mobile-nav-heading">Menu</h2>
              <button
                aria-label="Close primary navigation"
                className="icon-button site-mobile-nav__close"
                onClick={closeMobileMenu}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" size={22} />
              </button>
            </header>
            <nav
              aria-label="Mobile primary navigation"
              className="site-mobile-nav__links"
            >
              {primaryNavItems.map((item) => {
                const isActive = Boolean(item.active && active === item.active);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`site-mobile-nav__link${
                      isActive ? " is-active" : ""
                    }`}
                    href={item.href}
                    key={item.href}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
