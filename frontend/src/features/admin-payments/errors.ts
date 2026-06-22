import { ApiClientError } from "@/lib/errors/api-error";

export const ADMIN_PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  ADMIN_PAYMENT_NOT_FOUND: "That payment no longer exists.",
  ADMIN_PAYMENT_QUERY_INVALID:
    "The payment filters are invalid. Review them and retry.",
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  FORBIDDEN: "This account is not allowed to access payment diagnostics.",
  NETWORK_ERROR:
    "The admin payments API could not be reached. Check the backend and retry.",
  VALIDATION_ERROR: "The payment request is invalid. Review it and retry.",
};

export function getAdminPaymentErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof ApiClientError
    ? ADMIN_PAYMENT_ERROR_MESSAGES[error.code] || error.message || fallback
    : fallback;
}

export function getAdminPaymentRequestId(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.requestId : undefined;
}
