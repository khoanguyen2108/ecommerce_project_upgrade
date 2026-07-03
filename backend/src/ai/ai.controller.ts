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
} from "@nestjs/common";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { Throttle, ThrottlerException } from "@nestjs/throttler";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "../auth/types/authenticated-user";
import { SWAGGER_BEARER_AUTH_NAME } from "../common/swagger/api-docs.constants";
import {
  errorEnvelopeResponse,
  errorEnvelopeExample,
} from "../common/swagger/api-examples";
import { UserRole } from "../generated/prisma/enums";
import { ChatGateway } from "../chat/chat.gateway";
import { ChatService } from "../chat/chat.service";
import { AiProductRecommendationService } from "./ai-product-recommendation.service";
import { AiSupportService } from "./ai-support.service";
import { AiService } from "./ai.service";
import {
  RecommendProductsRequestDto,
  RecommendProductsResponseDto,
} from "./dto/recommend-products.dto";
import {
  StyleAdviceRequestDto,
  StyleAdviceResponseDto,
} from "./dto/style-advice.dto";
import { SupportRequestDto, SupportResponseDto } from "./dto/support.dto";

const STYLE_ADVICE_RATE_LIMIT_TTL_MS = 10 * 60 * 1000;
const STYLE_ADVICE_RATE_LIMIT = 20;
const RECOMMEND_PRODUCTS_RATE_LIMIT_TTL_MS = 10 * 60 * 1000;
const RECOMMEND_PRODUCTS_RATE_LIMIT = 5;
const SUPPORT_RATE_LIMIT_TTL_MS = 10 * 60 * 1000;
const SUPPORT_RATE_LIMIT = 10;

@Catch(ThrottlerException)
class AiRateLimitExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest>();
    const response = context.getResponse<Response>();
    const isProductRecommendationRoute = request.path.endsWith(
      "/recommend-products",
    );
    const isSupportRoute = request.path.endsWith("/support");

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      data: null,
      meta: {
        requestId: request.requestId,
      },
      error: {
        code: "AI_RATE_LIMITED",
        message: isSupportRoute
          ? "Too many AI support requests. Please try again later."
          : isProductRecommendationRoute
            ? "Too many product recommendation requests. Please try again later."
            : "Too many style assistant requests. Please try again later.",
      },
    });
  }
}

@ApiTags("ai")
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiExtraModels(
  StyleAdviceResponseDto,
  RecommendProductsResponseDto,
  SupportResponseDto,
)
@Controller("ai")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(AiRateLimitExceptionFilter)
@Roles(UserRole.CUSTOMER)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiProductRecommendationService: AiProductRecommendationService,
    private readonly aiSupportService: AiSupportService,
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
  ) {}

  @ApiOperation({
    summary: "Get grounded AI support for the current customer",
    description:
      "Uses the configured AI provider for support intent classification, backend-approved support content, and owner-scoped order tools. Customer prompts and AI replies are stored in chat history with AI clearly separated from admin replies.",
  })
  @ApiOkResponse({
    description:
      "Returns an AI answer, active order cards, a safe handoff, or an out-of-scope redirect. Out-of-scope requests are handled before policy, order, or provider work.",
    schema: {
      type: "object",
      properties: {
        data: { $ref: getSchemaPath(SupportResponseDto) },
        meta: {
          type: "object",
          properties: {
            requestId: { type: "string" },
          },
        },
        error: { type: "null" },
      },
    },
  })
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      "Request validation failed.",
      "Bad Request",
      "message must be longer than or equal to 2 characters.",
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      "Authentication is required.",
      "AUTH_REQUIRED",
      "Authentication is required.",
    ),
  )
  @ApiForbiddenResponse(
    errorEnvelopeResponse(
      "CUSTOMER role is required.",
      "FORBIDDEN",
      "You do not have permission to access this resource.",
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      "The order was not found or is not owned by the current customer.",
      "ORDER_NOT_FOUND",
      "Order was not found.",
    ),
  )
  @ApiTooManyRequestsResponse(
    errorEnvelopeResponse(
      "The local route throttle, Redis daily quota, or per-user concurrency limit was exceeded.",
      "AI_RATE_LIMITED",
      "Too many AI support requests. Please try again later.",
    ),
  )
  @ApiServiceUnavailableResponse(
    errorEnvelopeResponse(
      "AI configuration or Redis quota capacity is unavailable.",
      "AI_NOT_CONFIGURED",
      "Belikeme AI Support is not configured.",
    ),
  )
  @Post("support")
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: SUPPORT_RATE_LIMIT_TTL_MS,
      limit: SUPPORT_RATE_LIMIT,
      getTracker: (request: Record<string, unknown>) => {
        const authenticatedRequest = request as unknown as AuthenticatedRequest;

        return Promise.resolve(
          authenticatedRequest.user?.id ?? authenticatedRequest.ip ?? "unknown",
        );
      },
    },
  })
  async getSupport(
    @Body() dto: SupportRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const response = await this.aiSupportService.getSupport(dto, {
      requestId: request.requestId,
      userId: user.id,
    });
    const history = await this.chatService.saveAiExchange(
      user,
      dto.message,
      response,
    );

    if (history.notifyAdmin) {
      for (const message of history.messages) {
        this.chatGateway.broadcastMessageResult({
          conversation: history.conversation,
          message,
        });
      }
    }

    return {
      ...response,
      history: { messages: history.messages },
    };
  }

  @ApiOperation({
    summary: "Get grounded product recommendations",
    description:
      "Applies active-category, active-product, active in-stock variant, structured catalog, and effective-price filters before AI ranking. Returns canonical database product data or a clearly labelled catalog fallback.",
  })
  @ApiOkResponse({
    description:
      "Grounded product recommendations, catalog fallback, or an out-of-scope redirect returned.",
    schema: {
      type: "object",
      properties: {
        data: { $ref: getSchemaPath(RecommendProductsResponseDto) },
        meta: {
          type: "object",
          properties: {
            requestId: { type: "string" },
          },
        },
        error: { type: "null" },
      },
    },
  })
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      "Request validation failed.",
      "INVALID_RECOMMEND_PRODUCTS_REQUEST",
      "minBudget must be less than or equal to maxBudget.",
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      "Authentication is required.",
      "AUTH_REQUIRED",
      "Authentication is required.",
    ),
  )
  @ApiForbiddenResponse(
    errorEnvelopeResponse(
      "CUSTOMER role is required.",
      "FORBIDDEN",
      "You do not have permission to access this resource.",
    ),
  )
  @ApiTooManyRequestsResponse(
    errorEnvelopeResponse(
      "The local route throttle, Redis daily quota, or per-user concurrency limit was exceeded.",
      "AI_RATE_LIMITED",
      "Too many product recommendation requests. Please try again later.",
    ),
  )
  @ApiServiceUnavailableResponse({
    description:
      "AI is disabled, not configured, or unavailable. Disabled and transient provider failures normally return a catalog fallback when valid candidates exist.",
    content: {
      "application/json": {
        examples: {
          disabled: {
            value: errorEnvelopeExample(
              "AI_DISABLED",
              "Product recommendations are disabled.",
            ),
          },
          notConfigured: {
            value: errorEnvelopeExample(
              "AI_NOT_CONFIGURED",
              "Product recommendations are not configured.",
            ),
          },
          unavailable: {
            value: errorEnvelopeExample(
              "AI_UNAVAILABLE",
              "Product recommendations are temporarily unavailable.",
            ),
          },
          quotaUnavailable: {
            value: errorEnvelopeExample(
              "AI_QUOTA_UNAVAILABLE",
              "AI request capacity is temporarily unavailable. Please try again later.",
            ),
          },
        },
      },
    },
  })
  @ApiBadGatewayResponse(
    errorEnvelopeResponse(
      "The provider returned an invalid response and no fallback was available.",
      "AI_INVALID_RESPONSE",
      "Product recommendations returned an invalid response.",
    ),
  )
  @Post("recommend-products")
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: RECOMMEND_PRODUCTS_RATE_LIMIT_TTL_MS,
      limit: RECOMMEND_PRODUCTS_RATE_LIMIT,
      getTracker: (request: Record<string, unknown>) => {
        const authenticatedRequest = request as unknown as AuthenticatedRequest;

        return Promise.resolve(
          authenticatedRequest.user?.id ?? authenticatedRequest.ip ?? "unknown",
        );
      },
    },
  })
  recommendProducts(
    @Body() dto: RecommendProductsRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiProductRecommendationService.recommendProducts(dto, {
      requestId: request.requestId,
      userId: user.id,
    });
  }

  @ApiOperation({
    summary: "Get grounded clothing style advice",
    description:
      "Returns AI advice or a clearly labelled deterministic catalog fallback. Only active products with active in-stock variants can be returned.",
  })
  @ApiOkResponse({
    description:
      "Grounded style advice, catalog fallback, or an out-of-scope redirect returned.",
    schema: {
      type: "object",
      properties: {
        data: { $ref: getSchemaPath(StyleAdviceResponseDto) },
        meta: {
          type: "object",
          properties: {
            requestId: { type: "string" },
          },
        },
        error: { type: "null" },
      },
    },
  })
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      "Request validation failed.",
      "INVALID_STYLE_ADVICE_REQUEST",
      "Provide at least one style preference.",
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      "Authentication is required.",
      "AUTH_REQUIRED",
      "Authentication is required.",
    ),
  )
  @ApiForbiddenResponse(
    errorEnvelopeResponse(
      "CUSTOMER role is required.",
      "FORBIDDEN",
      "You do not have permission to access this resource.",
    ),
  )
  @ApiTooManyRequestsResponse(
    errorEnvelopeResponse(
      "The local route throttle, Redis daily quota, or per-user concurrency limit was exceeded.",
      "AI_RATE_LIMITED",
      "Too many style assistant requests. Please try again later.",
    ),
  )
  @ApiServiceUnavailableResponse({
    description:
      "AI is disabled, not configured, unavailable, or the provider is busy. Disabled and transient unavailable states normally return catalog fallback when candidates exist.",
    content: {
      "application/json": {
        examples: {
          disabled: {
            value: errorEnvelopeExample(
              "AI_DISABLED",
              "The style assistant is disabled.",
            ),
          },
          notConfigured: {
            value: errorEnvelopeExample(
              "AI_NOT_CONFIGURED",
              "The style assistant is not configured.",
            ),
          },
          unavailable: {
            value: errorEnvelopeExample(
              "AI_UNAVAILABLE",
              "The style assistant is temporarily unavailable.",
            ),
          },
          providerBusy: {
            value: errorEnvelopeExample(
              "AI_PROVIDER_BUSY",
              "The style assistant is busy. Please try again shortly.",
            ),
          },
          quotaUnavailable: {
            value: errorEnvelopeExample(
              "AI_QUOTA_UNAVAILABLE",
              "AI request capacity is temporarily unavailable. Please try again later.",
            ),
          },
        },
      },
    },
  })
  @ApiBadGatewayResponse(
    errorEnvelopeResponse(
      "The provider returned an invalid response and no fallback was available.",
      "AI_INVALID_RESPONSE",
      "The style assistant returned an invalid response.",
    ),
  )
  @Post("style-advice")
  @HttpCode(200)
  @Throttle({
    default: {
      ttl: STYLE_ADVICE_RATE_LIMIT_TTL_MS,
      limit: STYLE_ADVICE_RATE_LIMIT,
      getTracker: (request: Record<string, unknown>) => {
        const authenticatedRequest = request as unknown as AuthenticatedRequest;

        return Promise.resolve(
          authenticatedRequest.user?.id ?? authenticatedRequest.ip ?? "unknown",
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
