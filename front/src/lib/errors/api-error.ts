export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  requestId?: string;
  status?: number;

  constructor(
    message: string,
    code: string,
    status?: number,
    requestId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.details = details;
    this.status = status;
    this.requestId = requestId;
  }
}
