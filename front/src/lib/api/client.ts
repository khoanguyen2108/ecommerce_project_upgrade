import { API_BASE_URL } from "@/config/env";
import { getStoredAccessToken } from "@/features/auth/session";
import type { ApiResponse } from "@/lib/api/types";

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: unknown;
}

export class ApiClientError extends Error {
  code: string;
  requestId?: string;
  status?: number;

  constructor(message: string, code: string, status?: number, requestId?: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers);

  headers.set("accept", "application/json");

  if (options.body !== undefined) {
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
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
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
): Promise<ApiResponse<T> | undefined> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      "The server response could not be read. Please try again.",
      "INVALID_RESPONSE",
      response.status,
    );
  }
}
