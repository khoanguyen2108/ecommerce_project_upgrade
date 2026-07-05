import { API_BASE_URL } from "@/config/env";
import { getStoredAccessToken } from "@/features/auth/session";
import type { ApiEnvelope } from "@/lib/api/types";
import { ApiClientError } from "@/lib/errors/api-error";

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: unknown;
  onMeta?: (meta: ApiEnvelope<unknown>["meta"]) => void;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiClientError(
      "Belikeme API is not configured. Set NEXT_PUBLIC_API_BASE_URL and try again.",
      "API_BASE_URL_MISSING",
    );
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers);

  headers.set("accept", "application/json");

  const isMultipartBody = options.body instanceof FormData;
  const requestBody: BodyInit | undefined =
    options.body === undefined
      ? undefined
      : isMultipartBody
        ? (options.body as FormData)
        : JSON.stringify(options.body);

  if (options.body !== undefined && !isMultipartBody) {
    headers.set("content-type", "application/json");
  }

  if (options.auth) {
    const token = getStoredAccessToken();

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      body: requestBody,
      credentials: options.credentials ?? "include",
      headers,
    });
  } catch {
    throw new ApiClientError(
      "We could not reach Belikeme right now. Please check your connection and try again.",
      "NETWORK_ERROR",
    );
  }

  const envelope = await parseEnvelope<T>(response);
  const requestId = envelope?.meta?.requestId;

  if (envelope?.meta) {
    options.onMeta?.(envelope.meta);
  }

  if (!response.ok || envelope?.error) {
    const isServerError = response.status >= 500;
    const fallbackMessage =
      isServerError
        ? "Belikeme could not complete that request. Please try again in a moment."
        : "Request failed. Please check the details and try again.";

    throw new ApiClientError(
      isServerError ? fallbackMessage : envelope?.error?.message || fallbackMessage,
      envelope?.error?.code || String(response.status),
      response.status,
      requestId,
      envelope?.error?.details,
    );
  }

  if (!envelope || !("data" in envelope)) {
    throw new ApiClientError(
      "The server response could not be read. Please try again.",
      "INVALID_RESPONSE",
      response.status,
    );
  }

  return envelope.data as T;
}

async function parseEnvelope<T>(
  response: Response,
): Promise<ApiEnvelope<T> | undefined> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(
      "The server response could not be read. Please try again.",
      "INVALID_RESPONSE",
      response.status,
    );
  }
}

export { ApiClientError };
