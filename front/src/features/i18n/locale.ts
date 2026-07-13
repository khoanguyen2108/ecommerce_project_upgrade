export const SUPPORTED_LOCALES = ["en", "vi"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "belikemeLocale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}

export function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

    if (isLocale(storedLocale)) {
      return storedLocale;
    }

    return window.navigator.language.toLowerCase().startsWith("vi")
      ? "vi"
      : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The in-memory language still works when storage is unavailable.
  }
}
