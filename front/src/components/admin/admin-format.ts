import { ApiClientError } from "@/lib/errors/api-error";

export function formatAdminDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatOptional(value: string | null | undefined): string {
  return value && value.trim() ? value : "Not set";
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
    return messages[error.code] || error.message || fallback;
  }

  return fallback;
}

export function getApiRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}
