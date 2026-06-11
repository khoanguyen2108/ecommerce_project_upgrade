export interface ApiResponse<T> {
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
