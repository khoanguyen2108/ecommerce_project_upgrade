import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle, ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../auth/types/authenticated-user';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import {
  errorEnvelopeResponse,
  errorEnvelopeExample,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { AiService } from './ai.service';
import {
  StyleAdviceRequestDto,
  StyleAdviceResponseDto,
} from './dto/style-advice.dto';

const STYLE_ADVICE_RATE_LIMIT_TTL_MS = 10 * 60 * 1000;
const STYLE_ADVICE_RATE_LIMIT = 5;

@Catch(ThrottlerException)
class AiRateLimitExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest>();
    const response = context.getResponse<Response>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      data: null,
      meta: {
        requestId: request.requestId,
      },
      error: {
        code: 'AI_RATE_LIMITED',
        message: 'Too many style assistant requests. Please try again later.',
      },
    });
  }
}

@ApiTags('ai')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiExtraModels(StyleAdviceResponseDto)
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(AiRateLimitExceptionFilter)
@Roles(UserRole.CUSTOMER)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({
    summary: 'Get grounded clothing style advice',
    description:
      'Returns AI advice or a clearly labelled deterministic catalog fallback. Only active products with active in-stock variants can be returned.',
  })
  @ApiOkResponse({
    description: 'Grounded style advice or catalog fallback returned.',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(StyleAdviceResponseDto) },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
          },
        },
        error: { type: 'null' },
      },
    },
  })
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'INVALID_STYLE_ADVICE_REQUEST',
      'Provide at least one style preference.',
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Authentication is required.',
      'AUTH_REQUIRED',
      'Authentication is required.',
    ),
  )
  @ApiForbiddenResponse(
    errorEnvelopeResponse(
      'CUSTOMER role is required.',
      'FORBIDDEN',
      'You do not have permission to access this resource.',
    ),
  )
  @ApiTooManyRequestsResponse(
    errorEnvelopeResponse(
      'The local AI route quota was exceeded.',
      'AI_RATE_LIMITED',
      'Too many style assistant requests. Please try again later.',
    ),
  )
  @ApiServiceUnavailableResponse({
    description:
      'AI is disabled, not configured, unavailable, or the provider is busy. Disabled and transient unavailable states normally return catalog fallback when candidates exist.',
    content: {
      'application/json': {
        examples: {
          disabled: {
            value: errorEnvelopeExample(
              'AI_DISABLED',
              'The style assistant is disabled.',
            ),
          },
          notConfigured: {
            value: errorEnvelopeExample(
              'AI_NOT_CONFIGURED',
              'The style assistant is not configured.',
            ),
          },
          unavailable: {
            value: errorEnvelopeExample(
              'AI_UNAVAILABLE',
              'The style assistant is temporarily unavailable.',
            ),
          },
          providerBusy: {
            value: errorEnvelopeExample(
              'AI_PROVIDER_BUSY',
              'The style assistant is busy. Please try again shortly.',
            ),
          },
        },
      },
    },
  })
  @ApiBadGatewayResponse(
    errorEnvelopeResponse(
      'The provider returned an invalid response and no fallback was available.',
      'AI_INVALID_RESPONSE',
      'The style assistant returned an invalid response.',
    ),
  )
  @Post('style-advice')
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: STYLE_ADVICE_RATE_LIMIT_TTL_MS,
      limit: STYLE_ADVICE_RATE_LIMIT,
      getTracker: (request: Record<string, unknown>) => {
        const authenticatedRequest = request as unknown as AuthenticatedRequest;

        return Promise.resolve(
          authenticatedRequest.user?.id ?? authenticatedRequest.ip ?? 'unknown',
        );
      },
    },
  })
  getStyleAdvice(
    @Body() dto: StyleAdviceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiService.getStyleAdvice(dto, {
      requestId: request.requestId,
      userId: user.id,
    });
  }
}
