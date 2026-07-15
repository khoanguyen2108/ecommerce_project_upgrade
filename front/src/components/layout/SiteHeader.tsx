"use client";

import {
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type Ref, useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import type { TranslationKey } from "@/features/i18n/translations";
import { useI18n } from "@/features/i18n/useI18n";

type SiteHeaderActive =
  | "shop"
  | "categories"
  | "account"
  | "cart"
  | "orders"
  | "ai";

interface SiteHeaderProps {
  active?: SiteHeaderActive;
  brandHidden?: boolean;
  brandRef?: Ref<HTMLAnchorElement>;
  headerHidden?: boolean;
  introContentVisible?: boolean;
  variant?: "default" | "intro-transition";
}

type PrimaryNavItem = {
  active?: SiteHeaderActive;
  hideForAdmin?: boolean;
  href: string;
  labelKey: TranslationKey;
};

const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { active: "shop", href: "/products", labelKey: "nav.shop" },
  {
    active: "categories",
    href: "/categories",
    labelKey: "nav.categories",
  },
  {
    active: "ai",
    hideForAdmin: true,
    href: "/ai/style-assistant",
    labelKey: "nav.styleAssistant",
  },
  { href: "/#about", labelKey: "nav.about" },
];

export function SiteHeader({
  active,
  brandHidden = false,
  brandRef,
  headerHidden = false,
  introContentVisible = false,
  variant = "default",
}: SiteHeaderProps) {
  const { t } = useI18n();
  const { currentUser, isAuthenticated, isLoading, logout } = useAuthSession();
  const { cartCount, openCart } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const isAdmin = isAdminUser(currentUser);
  const showCustomerActions = !isLoading && !isAdmin;
  const primaryNavItems = PRIMARY_NAV_ITEMS.filter(
    (item) => !(item.hideForAdmin && isAdmin),
  );
  const cartLabel =
    cartCount > 0
      ? `${t("nav.cart")}, ${cartCount} ${
          cartCount === 1 ? t("cart.item") : t("cart.items")
        }`
      : t("nav.cart");
  const accountHref = isAuthenticated ? "/profile" : "/login";
  const accountLabel = isAuthenticated ? t("nav.profile") : t("nav.account");
  const mobileMenuId = "site-mobile-navigation";

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        headerRef.current &&
        !headerRef.current.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (headerHidden) {
      setIsMobileMenuOpen(false);
    }
  }, [headerHidden]);

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
    <header
      aria-hidden={headerHidden ? true : undefined}
      className={`site-header${
        variant === "intro-transition" ? " site-header--intro-transition" : ""
      }${
        variant === "intro-transition" && introContentVisible
          ? " site-header--intro-content-visible"
          : ""
      }`}
      inert={headerHidden ? true : undefined}
      ref={headerRef}
    >
      <div className="site-header__inner">
        <div className="site-header__left-actions">
          <button
            aria-controls={mobileMenuId}
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? t("nav.close") : t("nav.open")}
            className="icon-button site-menu-button"
            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Menu aria-hidden="true" size={20} strokeWidth={1.8} />
          </button>

          {showCustomerActions ? (
            <Link
              aria-label={accountLabel}
              className={`icon-button site-account-action site-account-action--mobile ${
                active === "account" ? "is-active" : ""
              }`}
              href={accountHref}
              title={accountLabel}
            >
              <User size={20} strokeWidth={1.8} />
            </Link>
          ) : null}
        </div>

        <nav aria-label={t("nav.primary")} className="site-nav">
          {primaryNavItems.map((item) => {
            const isActive = Boolean(item.active && active === item.active);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "is-active" : undefined}
                href={item.href}
                key={item.href}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <Link
          aria-hidden={brandHidden ? true : undefined}
          aria-label={t("nav.home")}
          className={`brand-mark brand-mark--image${
            variant === "intro-transition"
              ? " brand-mark--intro-transition"
              : ""
          }`}
          data-belikeme-brand-target={
            variant === "intro-transition" ? "true" : undefined
          }
          href="/"
          ref={brandRef}
          tabIndex={brandHidden ? -1 : undefined}
        >
          <Image
            alt=""
            aria-hidden="true"
            className="brand-mark__logo"
            height={457}
            priority
            src="/images/brand/belikeme-logo.png"
            width={1098}
          />
        </Link>

        <div className="site-actions">
          <LanguageSwitcher className="language-switcher--desktop" />
          {showCustomerActions && isAuthenticated ? (
            <button
              aria-label={cartLabel}
              className={`icon-button ${active === "cart" ? "is-active" : ""}`}
              onClick={openCart}
              title={t("nav.cart")}
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
                aria-label={t("nav.orders")}
                className={`icon-button ${active === "orders" ? "is-active" : ""}`}
                href="/orders"
                title={t("nav.orders")}
              >
                <ReceiptText size={20} strokeWidth={1.8} />
              </Link>
              <Link
                aria-label={t("nav.profile")}
                className={`icon-button site-account-action site-account-action--desktop ${
                  active === "account" ? "is-active" : ""
                }`}
                href="/profile"
                title={t("nav.profile")}
              >
                <User size={20} strokeWidth={1.8} />
              </Link>
            </>
          ) : null}
          {showCustomerActions && !isAuthenticated ? (
            <Link
              aria-label={t("nav.account")}
              className={`icon-button site-account-action site-account-action--desktop ${
                active === "account" ? "is-active" : ""
              }`}
              href="/login"
              title={t("nav.account")}
            >
              <User size={20} strokeWidth={1.8} />
            </Link>
          ) : null}
          {isAuthenticated ? (
            <button
              aria-label={t("nav.signOut")}
              className="icon-button"
              disabled={isLoading}
              onClick={() => void logout()}
              title={t("nav.signOut")}
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
        <nav
          aria-label={t("nav.mobilePrimary")}
          className="site-mobile-dropdown"
          id={mobileMenuId}
        >
          <LanguageSwitcher className="language-switcher--mobile" />
          <div className="site-mobile-dropdown__links">
            {primaryNavItems.map((item) => {
              const isActive = Boolean(item.active && active === item.active);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`site-mobile-dropdown__link${
                    isActive ? " is-active" : ""
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={closeMobileMenu}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
