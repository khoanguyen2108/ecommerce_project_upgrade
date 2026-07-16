import { ApiClientError } from "@/lib/errors/api-error";
import { getAdminOperationsTranslations } from "@/features/i18n/admin-operations-translations";
import type { Locale } from "@/features/i18n/locale";

export function getAdminOrderErrorMessage(
  error: unknown,
  fallback: string,
  locale: Locale = "en",
): string {
  if (!(error instanceof ApiClientError)) {
    return fallback;
  }

  const messages = getAdminOperationsTranslations(locale).orders.errors;
  return messages[error.code as keyof typeof messages] || fallback;
}

export function getAdminOrderRequestId(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.requestId : undefined;
}
