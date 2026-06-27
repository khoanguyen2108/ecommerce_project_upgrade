import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiConfigService } from './ai-config.service';
import {
  AiContextMapper,
  type AiCatalogCandidate,
  type AiCandidateProductRecord,
  type AiGroundedProductRecord,
  type GroundedProduct,
} from './ai-context.mapper';
import {
  AiOutputValidationError,
  AiOutputValidator,
  type ValidatedAiRecommendation,
} from './ai-output-validator';
import type {
  NormalizedStyleAdviceRequest,
  StyleAdviceRecommendationDto,
  StyleAdviceRequestDto,
  StyleAdviceResponseDto,
} from './dto/style-advice.dto';
import { AiProviderError, OpenRouterService } from './openrouter.service';

const MAX_CANDIDATE_PRODUCTS = 24;
const MAX_TOTAL_USER_TEXT_LENGTH = 800;
const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export interface StyleAdviceRequestContext {
  requestId?: string;
  userId: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiConfigService: AiConfigService,
    private readonly aiContextMapper: AiContextMapper,
    private readonly aiOutputValidator: AiOutputValidator,
    private readonly openRouterService: OpenRouterService,
  ) {}

  async getStyleAdvice(
    dto: StyleAdviceRequestDto,
    context: StyleAdviceRequestContext,
  ): Promise<StyleAdviceResponseDto> {
    const startedAt = Date.now();
    let candidateCount = 0;

    this.logEvent('AI_STYLE_ADVICE_REQUESTED', context, {
      candidateCount: 0,
      resultCount: 0,
      latencyMs: 0,
    });

    try {
      const request = this.normalizeRequest(dto);
      const config = this.aiConfigService.getRuntimeConfig();

      if (config.enabled && !this.aiConfigService.isConfigured()) {
        throw new ServiceUnavailableException({
          code: 'AI_NOT_CONFIGURED',
          message: 'The style assistant is not configured.',
        });
      }

      let candidates: AiCatalogCandidate[];

      try {
        candidates = await this.loadCandidates(request);
        candidateCount = candidates.length;
      } catch {
        throw new ServiceUnavailableException({
          code: config.enabled ? 'AI_UNAVAILABLE' : 'AI_DISABLED',
          message: config.enabled
            ? 'The style assistant is temporarily unavailable.'
            : 'The style assistant is disabled.',
        });
      }

      if (!config.enabled) {
        return await this.buildCatalogFallback(
          candidates,
          request,
          context,
          startedAt,
          'AI_DISABLED',
        );
      }

      if (candidates.length === 0) {
        return await this.buildCatalogFallback(
          candidates,
          request,
          context,
          startedAt,
          'AI_NO_CANDIDATES',
        );
      }

      let providerContent: string;

      try {
        providerContent = await this.openRouterService.requestStyleAdvice(
          request,
          candidates.map((candidate) => candidate.context),
        );
      } catch (error) {
        if (
          error instanceof AiProviderError &&
          error.code === 'AI_PROVIDER_BUSY'
        ) {
          throw new HttpException(
            {
              code: 'AI_PROVIDER_BUSY',
              message: 'The style assistant is busy. Please try again shortly.',
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        const errorCode =
          error instanceof AiProviderError
            ? error.code
            : 'AI_UNAVAILABLE';

        return await this.buildCatalogFallback(
          candidates,
          request,
          context,
          startedAt,
          errorCode,
        );
      }

      let output: ReturnType<AiOutputValidator['validateStyleAdvice']>;

      try {
        output = this.aiOutputValidator.validateStyleAdvice(
          providerContent,
          new Set(candidates.map((candidate) => candidate.ref)),
        );
      } catch (error) {
        if (!(error instanceof AiOutputValidationError)) {
          throw error;
        }

        return await this.buildCatalogFallback(
          candidates,
          request,
          context,
          startedAt,
          'AI_INVALID_RESPONSE',
        );
      }

      let recommendations: StyleAdviceRecommendationDto[];

      try {
        recommendations = await this.groundAiRecommendations(
          output.recommendations,
          candidates,
          request,
        );
      } catch {
        throw this.aiUnavailableException();
      }

      if (recommendations.length === 0) {
        return await this.buildCatalogFallback(
          candidates,
          request,
          context,
          startedAt,
          'AI_INVALID_RESPONSE',
        );
      }

      const response: StyleAdviceResponseDto = {
        mode: 'ai',
        summary: output.summary,
        recommendations,
        extraTips: output.extraTips,
      };

      this.logEvent('AI_STYLE_ADVICE_SUCCEEDED', context, {
        mode: response.mode,
        candidateCount: candidates.length,
        resultCount: recommendations.length,
        latencyMs: Date.now() - startedAt,
      });

      return response;
    } catch (error) {
      this.logEvent('AI_STYLE_ADVICE_FAILED', context, {
        candidateCount,
        resultCount: 0,
        latencyMs: Date.now() - startedAt,
        errorCode: this.getSafeErrorCode(error),
      });

      throw error;
    }
  }

  private normalizeRequest(
    dto: StyleAdviceRequestDto,
  ): NormalizedStyleAdviceRequest {
    const request: NormalizedStyleAdviceRequest = {
      ...(dto.occasion
        ? { occasion: this.normalizeUserText(dto.occasion) }
        : {}),
      ...(dto.style ? { style: this.normalizeUserText(dto.style) } : {}),
      ...(dto.budget !== undefined ? { budget: dto.budget } : {}),
      ...(dto.bodyType
        ? { bodyType: this.normalizeUserText(dto.bodyType) }
        : {}),
      preferredColors: this.normalizeUserTextArray(dto.preferredColors),
      preferredSizes: this.normalizeUserTextArray(dto.preferredSizes),
      ...(dto.notes ? { notes: this.normalizeUserText(dto.notes) } : {}),
    };

    if (
      request.budget !== undefined &&
      (!Number.isInteger(request.budget) ||
        request.budget < 0 ||
        request.budget > 2_000_000_000)
    ) {
      throw this.invalidRequestException('Budget is invalid.');
    }

    this.assertDistinctValues(request.preferredColors);
    this.assertDistinctValues(request.preferredSizes);

    const textLength = [
      request.occasion,
      request.style,
      request.bodyType,
      request.notes,
      ...request.preferredColors,
      ...request.preferredSizes,
    ].reduce((total, value) => total + (value?.length ?? 0), 0);

    if (textLength > MAX_TOTAL_USER_TEXT_LENGTH) {
      throw this.invalidRequestException(
        'Style request text must be 800 characters or fewer.',
      );
    }

    const hasMeaningfulField =
      request.budget !== undefined ||
      Boolean(request.occasion) ||
      Boolean(request.style) ||
      Boolean(request.bodyType) ||
      Boolean(request.notes) ||
      request.preferredColors.length > 0 ||
      request.preferredSizes.length > 0;

    if (!hasMeaningfulField) {
      throw this.invalidRequestException(
        'Provide at least one style preference.',
      );
    }

    return request;
  }

  private async loadCandidates(
    request: NormalizedStyleAdviceRequest,
  ): Promise<AiCatalogCandidate[]> {
    const variantWhere = this.buildVariantWhere(request);
    const products = await this.prismaService.product.findMany({
      where: this.buildProductWhere(request, variantWhere),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: MAX_CANDIDATE_PRODUCTS,
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        productCategories: {
          where: {
            category: {
              isActive: true,
            },
          },
          select: {
            category: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        variants: {
          where: variantWhere,
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
          select: {
            size: true,
            color: true,
            priceOverride: true,
          },
        },
      },
    });

    return this.aiContextMapper.mapCandidates(
      products satisfies AiCandidateProductRecord[],
      request,
    );
  }

  private async groundAiRecommendations(
    recommendations: ValidatedAiRecommendation[],
    candidates: AiCatalogCandidate[],
    request: NormalizedStyleAdviceRequest,
  ): Promise<StyleAdviceRecommendationDto[]> {
    const candidateByRef = new Map(
      candidates.map((candidate) => [candidate.ref, candidate]),
    );
    const productIds = recommendations
      .map((recommendation) => candidateByRef.get(recommendation.ref)?.productId)
      .filter((productId): productId is string => Boolean(productId));
    const groundedProducts = await this.loadGroundedProducts(productIds, request);
    const groundedById = new Map(
      groundedProducts.map((product) => [product.productId, product]),
    );

    return recommendations.flatMap((recommendation) => {
      const candidate = candidateByRef.get(recommendation.ref);
      const product = candidate
        ? groundedById.get(candidate.productId)
        : undefined;

      if (!product) {
        return [];
      }

      return [
        {
          ...product,
          reason: recommendation.reason,
          ...(recommendation.stylingTip
            ? { stylingTip: recommendation.stylingTip }
            : {}),
        },
      ];
    });
  }

  private async buildCatalogFallback(
    candidates: AiCatalogCandidate[],
    request: NormalizedStyleAdviceRequest,
    context: StyleAdviceRequestContext,
    startedAt: number,
    errorCode: string,
  ): Promise<StyleAdviceResponseDto> {
    let groundedProducts: GroundedProduct[];

    try {
      groundedProducts = await this.loadGroundedProducts(
        candidates.map((candidate) => candidate.productId),
        request,
      );
    } catch {
      throw errorCode === 'AI_DISABLED'
        ? new ServiceUnavailableException({
            code: 'AI_DISABLED',
            message: 'The style assistant is disabled.',
          })
        : this.aiUnavailableException();
    }
    const groundedById = new Map(
      groundedProducts.map((product) => [product.productId, product]),
    );
    const recommendations = candidates
      .map((candidate) => groundedById.get(candidate.productId))
      .filter((product): product is GroundedProduct => Boolean(product))
      .slice(0, 4)
      .map((product) => ({
        ...product,
        reason: 'This currently available item matches the catalog filters you provided.',
      }));
    const hasRecommendations = recommendations.length > 0;
    const response: StyleAdviceResponseDto = {
      mode: 'catalog_fallback',
      summary: hasRecommendations
        ? 'Here are currently available catalog options that match your filters.'
        : 'No matching in-stock products were found. Try broadening your budget, color, size, or style preferences.',
      recommendations,
      extraTips: hasRecommendations
        ? [
            'Check the current size and color options on the product page before adding an item to your cart.',
          ]
        : [],
    };

    this.logEvent('AI_STYLE_ADVICE_FALLBACK', context, {
      mode: response.mode,
      candidateCount: candidates.length,
      resultCount: recommendations.length,
      latencyMs: Date.now() - startedAt,
      errorCode,
    });

    return response;
  }

  private async loadGroundedProducts(
    productIds: string[],
    request: NormalizedStyleAdviceRequest,
  ): Promise<GroundedProduct[]> {
    if (productIds.length === 0) {
      return [];
    }

    const variantWhere = this.buildVariantWhere(request);
    const products = await this.prismaService.product.findMany({
      where: this.buildProductWhere(request, variantWhere, productIds),
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrls: true,
        basePrice: true,
        variants: {
          where: variantWhere,
          select: {
            priceOverride: true,
          },
        },
      },
    });

    return (products satisfies AiGroundedProductRecord[])
      .filter((product) =>
        product.variants.some(
          (variant) =>
            request.budget === undefined ||
            (variant.priceOverride ?? product.basePrice) <= request.budget,
        ),
      )
      .map((product) => ({
        ...product,
        variants: product.variants.filter(
          (variant) =>
            request.budget === undefined ||
            (variant.priceOverride ?? product.basePrice) <= request.budget,
        ),
      }))
      .map((product) => this.aiContextMapper.mapGroundedProduct(product));
  }

  private buildVariantWhere(
    request: NormalizedStyleAdviceRequest,
  ): Prisma.ProductVariantWhereInput {
    return {
      isActive: true,
      stock: {
        gt: 0,
      },
      ...(request.preferredColors.length > 0
        ? {
            color: {
              in: request.preferredColors,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(request.preferredSizes.length > 0
        ? {
            size: {
              in: request.preferredSizes,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };
  }

  private buildProductWhere(
    request: NormalizedStyleAdviceRequest,
    variantWhere: Prisma.ProductVariantWhereInput,
    productIds?: string[],
  ): Prisma.ProductWhereInput {
    const budgetWhere: Prisma.ProductWhereInput | undefined =
      request.budget === undefined
        ? undefined
        : {
            OR: [
              {
                variants: {
                  some: {
                    ...variantWhere,
                    priceOverride: {
                      lte: request.budget,
                    },
                  },
                },
              },
              {
                basePrice: {
                  lte: request.budget,
                },
                variants: {
                  some: {
                    ...variantWhere,
                    priceOverride: null,
                  },
                },
              },
            ],
          };

    return {
      ...(productIds ? { id: { in: productIds } } : {}),
      isActive: true,
      category: {
        isActive: true,
      },
      variants: {
        some: variantWhere,
      },
      ...(budgetWhere ? { AND: [budgetWhere] } : {}),
    };
  }

  private normalizeUserTextArray(values: string[] | undefined): string[] {
    return (values ?? []).map((value) => this.normalizeUserText(value));
  }

  private normalizeUserText(value: string): string {
    if (
      typeof value !== 'string' ||
      DISALLOWED_CONTROL_CHARACTERS.test(value)
    ) {
      throw this.invalidRequestException(
        'Style request contains unsupported characters.',
      );
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      throw this.invalidRequestException('Style request fields cannot be empty.');
    }

    return normalized;
  }

  private assertDistinctValues(values: string[]) {
    const normalizedValues = values.map((value) => value.toLocaleLowerCase());

    if (new Set(normalizedValues).size !== normalizedValues.length) {
      throw this.invalidRequestException(
        'Preferred colors and sizes cannot contain duplicates.',
      );
    }
  }

  private invalidRequestException(message: string): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_STYLE_ADVICE_REQUEST',
      message,
    });
  }

  private aiUnavailableException(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'AI_UNAVAILABLE',
      message: 'The style assistant is temporarily unavailable.',
    });
  }

  private getSafeErrorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return response.code;
      }
    }

    return 'AI_INTERNAL_ERROR';
  }

  private logEvent(
    event: string,
    context: StyleAdviceRequestContext,
    fields: {
      mode?: StyleAdviceResponseDto['mode'];
      candidateCount: number;
      resultCount: number;
      latencyMs: number;
      errorCode?: string;
    },
  ) {
    this.logger.log(
      JSON.stringify({
        event,
        requestId: context.requestId,
        userId: context.userId,
        ...fields,
      }),
    );
  }
}
