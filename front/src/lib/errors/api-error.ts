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
