"use client";

import Link from "next/link";
import { useI18n } from "@/features/i18n/useI18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="site-footer" id="about">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link className="brand-mark" href="/">
            BELIKEME
          </Link>
          <p>{t("footer.tagline")}</p>
        </div>

        <div className="site-footer__links" aria-label={t("footer.links")}>
          <div>
            <h2>{t("footer.support")}</h2>
            <Link href="/#delivery">{t("footer.shipping")}</Link>
            <Link href="/login">{t("footer.accountHelp")}</Link>
            <Link href="/products">{t("footer.newArrivals")}</Link>
          </div>
          <div>
            <h2>{t("footer.store")}</h2>
            <Link href="/#categories">{t("footer.categories")}</Link>
            <Link href="/#trust">{t("footer.why")}</Link>
            <Link href="/register">{t("footer.createAccount")}</Link>
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>&copy; 2026 {t("footer.rights")}</span>
      </div>
    </footer>
  );
}
