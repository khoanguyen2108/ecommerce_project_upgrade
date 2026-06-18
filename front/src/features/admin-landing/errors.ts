import {
  getApiErrorMessage,
  getApiRequestId,
} from "@/components/admin/admin-format";

const ADMIN_LANDING_ERROR_MESSAGES: Record<string, string> = {
  ADMIN_LANDING_HERO_IMAGE_URL_INVALID:
    "Enter a valid public HTTP or HTTPS URL for the hero image.",
  ADMIN_LANDING_SUBTITLE_INVALID:
    "The hero subtitle contains invalid content or is too long.",
  ADMIN_LANDING_TITLE_INVALID:
    "The hero heading contains invalid content or is too long.",
  ADMIN_LANDING_UPDATE_EMPTY: "Change at least one landing page field.",
  API_BASE_URL_MISSING:
    "The landing page API is not configured for this frontend environment.",
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some landing page fields are invalid. Review the form.",
  FORBIDDEN: "This account is not allowed to manage the landing page.",
  NETWORK_ERROR:
    "The landing page API could not be reached. Check the backend and retry.",
  VALIDATION_ERROR: "Some landing page fields are invalid. Review the form.",
};

export function getAdminLandingError(error: unknown): {
  message: string;
  requestId?: string;
} {
  return {
    message: getApiErrorMessage(
      error,
      ADMIN_LANDING_ERROR_MESSAGES,
      "Landing page settings could not be loaded right now.",
    ),
    requestId: getApiRequestId(error),
  };
}
