import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { RequestWithId } from '../types/request-with-id';

interface ApiEnvelope<T> {
  data: T | null;
  meta: {
    requestId?: string;
  };
  error: null;
}

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data) => ({
        data: data ?? null,
        meta: {
          requestId: request.requestId,
        },
        error: null,
      })),
    );
  }
}
