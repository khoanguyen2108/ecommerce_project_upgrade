import {
  getApiErrorMessage,
  getApiRequestId,
} from "@/components/admin/admin-format";

const ADMIN_STATS_ERROR_MESSAGES: Record<string, string> = {
  API_BASE_URL_MISSING:
    "The stats API is not configured for this frontend environment.",
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some dashboard filters are invalid. Review the date range.",
  FORBIDDEN: "This account is not allowed to view admin analytics.",
  NETWORK_ERROR:
    "The dashboard could not reach the stats API. Check the backend and retry.",
  STATS_DATE_RANGE_INVALID: "The from date must be before or equal to the to date.",
  STATS_DATE_RANGE_TOO_LARGE:
    "This date range is too large. Choose a shorter range and retry.",
  VALIDATION_ERROR: "Some dashboard filters are invalid. Review the date range.",
};

export function getAdminStatsError(error: unknown): {
  message: string;
  requestId?: string;
} {
  return {
    message: getApiErrorMessage(
      error,
      ADMIN_STATS_ERROR_MESSAGES,
      "Admin analytics could not be loaded right now.",
    ),
    requestId: getApiRequestId(error),
  };
}
