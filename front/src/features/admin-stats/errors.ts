import { ApiClientError } from "@/lib/errors/api-error";

const STATS_ERROR_MESSAGES = {
  apiUnavailable: "The dashboard API could not be reached. Check the backend and retry.",
  authRequired: "Your admin session is required. Sign in again to continue.",
  badRequest: "Some dashboard filters are invalid. Review the date range and try again.",
  forbidden: "This account is not allowed to view admin analytics.",
  generic: "Dashboard data could not be loaded right now.",
  network: "The dashboard API could not be reached. Check the backend and retry.",
  rangeTooLarge: "The selected date range is too large.",
};

export function getAdminStatsError(error: unknown): {
  message: string;
  requestId?: string;
} {
  const messageByCode: Record<string, string> = {
    API_BASE_URL_MISSING: STATS_ERROR_MESSAGES.apiUnavailable,
    AUTH_REQUIRED: STATS_ERROR_MESSAGES.authRequired,
    BAD_REQUEST: STATS_ERROR_MESSAGES.badRequest,
    FORBIDDEN: STATS_ERROR_MESSAGES.forbidden,
    NETWORK_ERROR: STATS_ERROR_MESSAGES.network,
    STATS_DATE_RANGE_INVALID: STATS_ERROR_MESSAGES.badRequest,
    STATS_DATE_RANGE_TOO_LARGE: STATS_ERROR_MESSAGES.rangeTooLarge,
    VALIDATION_ERROR: STATS_ERROR_MESSAGES.badRequest,
  };

  if (!(error instanceof ApiClientError)) {
    return { message: STATS_ERROR_MESSAGES.generic };
  }

  return {
    message: messageByCode[error.code] || STATS_ERROR_MESSAGES.generic,
    requestId: error.requestId,
  };
}
