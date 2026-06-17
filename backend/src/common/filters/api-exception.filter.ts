import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../types/request-with-id';

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
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({
          requestId: request.requestId,
          method: request.method,
          path: request.path,
          statusCode: status,
          error:
            exception instanceof Error ? exception.name : 'UnknownServerError',
        }),
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
        requestId: request.requestId,
      },
      error: errorBody,
    });
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
}
