"use client";

import type { Locale } from "@/features/i18n/locale";
import { useI18n } from "@/features/i18n/useI18n";

const OPTIONS: Array<{ code: string; label: string; locale: Locale }> = [
  { code: "EN", label: "English", locale: "en" },
  { code: "VI", label: "Tiếng Việt", locale: "vi" },
];

export function AdminLanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      aria-label={t("language.change")}
      className="admin-language-switcher"
      role="group"
    >
      {OPTIONS.map((option) => (
        <button
          aria-label={option.label}
          aria-pressed={locale === option.locale}
          className={locale === option.locale ? "is-active" : undefined}
          key={option.locale}
          onClick={() => setLocale(option.locale)}
          type="button"
        >
          {option.code}
        </button>
      ))}
    </div>
  );
}
