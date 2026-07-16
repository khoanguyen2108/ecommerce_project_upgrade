import { ApiClientError } from "@/lib/errors/api-error";
import type { Locale } from "@/features/i18n/locale";

export function formatAdminDate(
  value: string,
  locale: Locale = "en",
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return locale === "vi" ? "Không khả dụng" : "Not available";
  }

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatOptional(
  value: string | null | undefined,
  locale: Locale = "en",
): string {
  return value && value.trim()
    ? value
    : locale === "vi"
      ? "Chưa thiết lập"
      : "Not set";
}

export function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export function parseActiveFilter(value: string): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

export function getBooleanFilterValue(value: boolean | undefined): string {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

export function getApiErrorMessage(
  error: unknown,
  messages: Record<string, string>,
  fallback: string,
): string {
  if (error instanceof ApiClientError) {
    return messages[error.code] || fallback;
  }

  return fallback;
}

export function getApiRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}
