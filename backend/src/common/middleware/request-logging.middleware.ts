import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { RequestWithId } from '../types/request-with-id';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = this.getIncomingRequestId(request) ?? randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.setHeader(CORRELATION_ID_HEADER, requestId);

    response.on('finish', () => {
      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      );
    });

    next();
  }

  private getIncomingRequestId(request: RequestWithId): string | undefined {
    const rawRequestId =
      request.header(REQUEST_ID_HEADER) ?? request.header(CORRELATION_ID_HEADER);

    if (!rawRequestId || rawRequestId.length > MAX_REQUEST_ID_LENGTH) {
      return undefined;
    }

    if (!REQUEST_ID_PATTERN.test(rawRequestId)) {
      return undefined;
    }

    return rawRequestId;
  }
}
