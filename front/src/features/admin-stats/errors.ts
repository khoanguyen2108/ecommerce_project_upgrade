import { getAdminCommonMessages } from "@/features/i18n/admin-common-translations";
import type { Locale } from "@/features/i18n/locale";
import { ApiClientError } from "@/lib/errors/api-error";

export function getAdminStatsError(error: unknown, locale: Locale): {
  message: string;
  requestId?: string;
} {
  const messages = getAdminCommonMessages(locale).statsErrors;
  const messageByCode: Record<string, string> = {
    API_BASE_URL_MISSING: messages.apiUnavailable,
    AUTH_REQUIRED: messages.authRequired,
    BAD_REQUEST: messages.badRequest,
    FORBIDDEN: messages.forbidden,
    NETWORK_ERROR: messages.network,
    STATS_DATE_RANGE_INVALID: messages.badRequest,
    STATS_DATE_RANGE_TOO_LARGE: messages.rangeTooLarge,
    VALIDATION_ERROR: messages.badRequest,
  };

  if (!(error instanceof ApiClientError)) {
    return { message: messages.generic };
  }

  return {
    message: messageByCode[error.code] || messages.generic,
    requestId: error.requestId,
  };
}
