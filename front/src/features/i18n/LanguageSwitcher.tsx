"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/features/i18n/locale";
import { useI18n } from "@/features/i18n/useI18n";

interface LanguageSwitcherProps {
  className?: string;
}

const OPTIONS: Array<{ code: string; label: string; locale: Locale }> = [
  { code: "VI", label: "Tiếng Việt", locale: "vi" },
  { code: "EN", label: "English", locale: "en" },
];

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        switcherRef.current &&
        !switcherRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  function selectLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setIsOpen(false);
  }

  return (
    <div
      className={`language-switcher${className ? ` ${className}` : ""}`}
      ref={switcherRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t("language.change")}
        className="language-switcher__trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {locale.toUpperCase()}
      </button>

      {isOpen ? (
        <div
          aria-label={t("language.change")}
          className="language-switcher__menu"
          role="group"
        >
          {OPTIONS.map((option) => (
            <button
              aria-pressed={locale === option.locale}
              className={`language-switcher__option${
                locale === option.locale ? " is-active" : ""
              }`}
              key={option.locale}
              onClick={() => selectLocale(option.locale)}
              type="button"
            >
              <span aria-hidden="true" className="language-switcher__badge">
                {option.code}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
