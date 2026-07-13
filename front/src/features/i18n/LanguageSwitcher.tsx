"use client";

import type { Locale } from "@/features/i18n/locale";
import { useI18n } from "@/features/i18n/useI18n";

interface LanguageSwitcherProps {
  className?: string;
}

const OPTIONS: Array<{ label: string; locale: Locale }> = [
  { label: "EN", locale: "en" },
  { label: "VI", locale: "vi" },
];

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      aria-label={t("language.change")}
      className={`language-switcher${className ? ` ${className}` : ""}`}
      role="group"
    >
      {OPTIONS.map((option) => (
        <button
          aria-label={`${t("language.change")}: ${option.label}`}
          aria-pressed={locale === option.locale}
          className={locale === option.locale ? "is-active" : undefined}
          key={option.locale}
          onClick={() => setLocale(option.locale)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
