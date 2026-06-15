export interface ApiEnvelope<T> {
  data: T | null;
  meta: {
    requestId?: string;
  };
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  data: null;
  meta: {
    requestId?: string;
  };
  error: ApiError;
}

export type ApiResponse<T> = ApiEnvelope<T>;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
