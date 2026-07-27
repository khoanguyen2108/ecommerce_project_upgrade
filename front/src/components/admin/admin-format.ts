import { ApiClientError } from "@/lib/errors/api-error";

export function formatAdminDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatOptional(
  value: string | null | undefined,
): string {
  return value && value.trim() ? value : "Not set";
}

export function formatAdminNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatAdminMoney(value: number): string {
  return `${formatAdminNumber(value)} VND`;
}

export function formatAdminPercent(value: number): string {
  return `${formatAdminNumber(value)}%`;
}

export const formatAdminCatalogNumber = formatAdminNumber;
export const formatAdminCatalogMoney = formatAdminMoney;
export const formatAdminCatalogPercent = formatAdminPercent;

export function formatAdminNotificationLabel(label: string, count: number): string {
  return `${label}, ${formatAdminNumber(count)} new`;
}

export function formatAdminNotificationTitle(label: string, count: number): string {
  return `${formatAdminNumber(count)} new ${label}`;
}

export function formatAdminPaginationSummary(
  page: number,
  totalPages: number,
  total: number,
  noun: string,
): string {
  return `Page ${formatAdminNumber(page)} of ${formatAdminNumber(totalPages)} (${formatAdminNumber(total)} ${noun})`;
}

export function formatAdminPaginationLabel(noun: string): string {
  return `${noun} pagination`;
}

export function formatAdminLoadingLabel(label: string): string {
  return `Loading ${label}`;
}

export function formatAdminSoldCount(count: number): string {
  return `${formatAdminNumber(count)} sold`;
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

export const getAdminCatalogErrorMessage = getApiErrorMessage;

export function getApiRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}
