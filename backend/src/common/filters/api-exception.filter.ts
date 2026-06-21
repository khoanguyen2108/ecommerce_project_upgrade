import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { RequestWithId } from '../types/request-with-id';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';
const PAYOS_WEBHOOK_ENDPOINT_PATH = '/payments/payos/webhook';

type HttpExceptionResponse =
  | string
  | {
      code?: string;
      details?: unknown;
      error?: string;
      message?: string | string[];
      statusCode?: number;
    };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = this.ensureRequestId(request, response);
    const status = this.getExceptionStatus(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          statusCode: status,
          error:
            exception instanceof Error ? exception.name : 'UnknownServerError',
        }),
      );
    }

    if (
      status === HttpStatus.BAD_REQUEST &&
      request.path === PAYOS_WEBHOOK_ENDPOINT_PATH
    ) {
      this.logger.warn(
        `[payos-webhook] request-error ${JSON.stringify(
          this.stripUndefinedValues({
            requestId,
            method: this.sanitizeLogString(request.method, 16),
            path: this.sanitizeLogString(request.path, 180),
            statusCode: status,
            safeErrorType: this.getSafeExceptionType(exception),
            safeErrorMessageSummary:
              this.getSafeExceptionMessageSummary(exception),
          }),
        )}`,
      );
    }

    const exceptionResponse =
      exception instanceof HttpException
        ? (exception.getResponse() as HttpExceptionResponse)
        : undefined;

    const errorBody: {
      code: string;
      details?: unknown;
      message: string;
    } = {
      code: this.getErrorCode(status, exceptionResponse),
      message: this.getErrorMessage(status, exceptionResponse),
    };
    const errorDetails = this.getErrorDetails(exceptionResponse);

    if (errorDetails !== undefined) {
      errorBody.details = errorDetails;
    }

    response.status(status).json({
      data: null,
      meta: {
        requestId,
      },
      error: errorBody,
    });
  }

  private ensureRequestId(
    request: RequestWithId,
    response: Response,
  ): string {
    const requestId = request.requestId ?? randomUUID();

    request.requestId = requestId;

    if (!response.headersSent) {
      response.setHeader(REQUEST_ID_HEADER, requestId);
      response.setHeader(CORRELATION_ID_HEADER, requestId);
    }

    return requestId;
  }

  private getExceptionStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    const statusCode =
      this.getNumericExceptionField(exception, 'statusCode') ??
      this.getNumericExceptionField(exception, 'status');

    if (
      statusCode !== undefined &&
      statusCode >= HttpStatus.BAD_REQUEST &&
      statusCode <= 599
    ) {
      return statusCode;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getNumericExceptionField(
    exception: unknown,
    field: 'status' | 'statusCode',
  ): number | undefined {
    if (!this.isRecord(exception)) {
      return undefined;
    }

    const value = exception[field];

    return typeof value === 'number' && Number.isInteger(value)
      ? value
      : undefined;
  }

  private getErrorCode(
    status: number,
    exceptionResponse?: HttpExceptionResponse,
  ): string {
    if (typeof exceptionResponse === 'object' && exceptionResponse?.code) {
      return exceptionResponse.code;
    }

    return HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR';
  }

  private getErrorMessage(
    status: number,
    exceptionResponse?: HttpExceptionResponse,
  ): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse?.message) {
      return Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message.join('; ')
        : exceptionResponse.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Unexpected server error.';
    }

    return 'Request failed.';
  }

  private getErrorDetails(
    exceptionResponse?: HttpExceptionResponse,
  ): unknown {
    if (typeof exceptionResponse === 'object' && exceptionResponse?.details) {
      return exceptionResponse.details;
    }

    return undefined;
  }

  private getSafeExceptionType(exception: unknown): string {
    const rawType = this.isRecord(exception) && typeof exception.type === 'string'
      ? exception.type
      : exception instanceof Error
        ? exception.name
        : 'UnknownError';

    return this.sanitizeLogString(rawType, 80) ?? 'UnknownError';
  }

  private getSafeExceptionMessageSummary(exception: unknown): string {
    if (exception instanceof Error) {
      return (
        this.sanitizeLogString(exception.message, 180) ?? 'Request failed.'
      );
    }

    return 'Request failed.';
  }

  private sanitizeLogString(
    value: string | undefined,
    maxLength: number,
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    return value
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[^\x20-\x7E]/g, '?')
      .slice(0, maxLength);
  }

  private stripUndefinedValues(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
