import {
  BadRequestException,
  HttpException,
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
  type AiRecommendationGroundedProductRecord,
  type RecommendationGroundedProduct,
} from './ai-context.mapper';
import {
  AiOutputValidationError,
  AiOutputValidator,
  type ValidatedProductRecommendation,
} from './ai-output-validator';
import type {
  NormalizedRecommendProductsRequest,
  RecommendProductsAppliedFiltersDto,
  RecommendProductsRecommendationDto,
  RecommendProductsRequestDto,
  RecommendProductsResponseDto,
} from './dto/recommend-products.dto';
import { AiProviderError, OpenRouterService } from './openrouter.service';
import { AiQuotaService } from './ai-quota.service';
import { AiScopeService, type AiScopeLocale } from './ai-scope.service';

const MAX_DB_CANDIDATE_PRODUCTS = 50;
const MAX_VND_AMOUNT = 2_000_000_000;
const MAX_FILTER_VALUES = 5;
const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export interface ProductRecommendationRequestContext {
  requestId?: string;
  userId: string;
}

@Injectable()
export class AiProductRecommendationService {
  private readonly logger = new Logger(AiProductRecommendationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiConfigService: AiConfigService,
    private readonly aiContextMapper: AiContextMapper,
    private readonly aiOutputValidator: AiOutputValidator,
    private readonly openRouterService: OpenRouterService,
    private readonly aiScopeService: AiScopeService,
    private readonly aiQuotaService: AiQuotaService,
  ) {}

  async recommendProducts(
    dto: RecommendProductsRequestDto,
    context: ProductRecommendationRequestContext,
  ): Promise<RecommendProductsResponseDto> {
    const startedAt = Date.now();
    let candidateCount = 0;

    this.logEvent('AI_RECOMMEND_PRODUCTS_REQUESTED', context, {
      candidateCount: 0,
      resultCount: 0,
      latencyMs: 0,
    });

    try {
      const request = this.normalizeRequest(dto);
      const scopeDecision =
        this.aiScopeService.evaluateProductRecommendation(request);

      this.aiScopeService.logDecision(
        '/ai/recommend-products',
        scopeDecision,
        context,
      );

      if (scopeDecision.result !== 'allowed') {
        return this.buildOutOfScopeResponse(request, scopeDecision.locale);
      }

      const quotaLease = await this.aiQuotaService.acquire(
        'recommend-products',
        context.userId,
      );

      try {
      const config = this.aiConfigService.getRuntimeConfig();

      if (config.enabled && !this.aiConfigService.isConfigured()) {
        throw new ServiceUnavailableException({
          code: 'AI_NOT_CONFIGURED',
          message: 'Product recommendations are not configured.',
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
            ? 'Product recommendations are temporarily unavailable.'
            : 'Product recommendations are disabled.',
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
        providerContent =
          await this.openRouterService.requestProductRecommendations(
            request,
            candidates.map((candidate) => candidate.context),
          );
      } catch (error) {
        return await this.buildCatalogFallback(
          candidates,
          request,
          context,
          startedAt,
          error instanceof AiProviderError ? error.code : 'AI_UNAVAILABLE',
        );
      }

      let output: ReturnType<
        AiOutputValidator['validateProductRecommendations']
      >;

      try {
        output = this.aiOutputValidator.validateProductRecommendations(
          providerContent,
          new Set(candidates.map((candidate) => candidate.ref)),
          request.limit,
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

      let recommendations: RecommendProductsRecommendationDto[];

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

      const response: RecommendProductsResponseDto = {
        mode: 'ai',
        summary: output.summary,
        appliedFilters: this.buildAppliedFilters(request),
        recommendations,
        noMatchSuggestions: output.noMatchSuggestions,
      };

      this.logEvent('AI_RECOMMEND_PRODUCTS_SUCCEEDED', context, {
        mode: response.mode,
        candidateCount: candidates.length,
        resultCount: recommendations.length,
        latencyMs: Date.now() - startedAt,
      });

      return response;
      } finally {
        await this.aiQuotaService.release(quotaLease);
      }
    } catch (error) {
      this.logEvent('AI_RECOMMEND_PRODUCTS_FAILED', context, {
        candidateCount,
        resultCount: 0,
        latencyMs: Date.now() - startedAt,
        errorCode: this.getSafeErrorCode(error),
      });

      throw error;
    }
  }

  private normalizeRequest(
    dto: RecommendProductsRequestDto,
  ): NormalizedRecommendProductsRequest {
    const query = this.normalizeUserText(dto.query, 'query');
    const categorySlugs = this.normalizeArray(
      dto.categorySlugs,
      'categorySlugs',
      (value) => this.normalizeSlug(value),
    );
    const colors = this.normalizeArray(
      dto.colors,
      'colors',
      (value) => this.normalizeUserText(value, 'colors'),
    );
    const sizes = this.normalizeArray(
      dto.sizes,
      'sizes',
      (value) => this.normalizeUserText(value, 'sizes').toUpperCase(),
    );
    const limit = dto.limit ?? 6;

    if (query.length < 3 || query.length > 500) {
      throw this.invalidRequestException(
        'Query must be between 3 and 500 characters.',
      );
    }

    this.assertBudget(dto.minBudget, 'minBudget');
    this.assertBudget(dto.maxBudget, 'maxBudget');

    if (
      dto.minBudget !== undefined &&
      dto.maxBudget !== undefined &&
      dto.minBudget > dto.maxBudget
    ) {
      throw this.invalidRequestException(
        'minBudget must be less than or equal to maxBudget.',
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 8) {
      throw this.invalidRequestException('Limit must be between 1 and 8.');
    }

    this.assertDistinctValues(categorySlugs, 'Category slugs');
    this.assertDistinctValues(colors, 'Colors');
    this.assertDistinctValues(sizes, 'Sizes');

    return {
      query,
      ...(dto.minBudget !== undefined
        ? { minBudget: dto.minBudget }
        : {}),
      ...(dto.maxBudget !== undefined
        ? { maxBudget: dto.maxBudget }
        : {}),
      categorySlugs,
      colors,
      sizes,
      limit,
    };
  }

  private async loadCandidates(
    request: NormalizedRecommendProductsRequest,
  ): Promise<AiCatalogCandidate[]> {
    const variantWhere = this.buildVariantWhere(request);
    const products = await this.prismaService.product.findMany({
      where: this.buildProductWhere(request, variantWhere),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: MAX_DB_CANDIDATE_PRODUCTS,
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

    return this.aiContextMapper.mapRecommendationCandidates(
      products satisfies AiCandidateProductRecord[],
      request,
    );
  }

  private async groundAiRecommendations(
    recommendations: ValidatedProductRecommendation[],
    candidates: AiCatalogCandidate[],
    request: NormalizedRecommendProductsRequest,
  ): Promise<RecommendProductsRecommendationDto[]> {
    const candidateByRef = new Map(
      candidates.map((candidate) => [candidate.ref, candidate]),
    );
    const productIds = recommendations
      .map((recommendation) => candidateByRef.get(recommendation.ref)?.productId)
      .filter((productId): productId is string => Boolean(productId));
    const groundedProducts = await this.loadGroundedProducts(
      productIds,
      request,
    );
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

      return [{ ...product, reason: recommendation.reason }];
    });
  }

  private async buildCatalogFallback(
    candidates: AiCatalogCandidate[],
    request: NormalizedRecommendProductsRequest,
    context: ProductRecommendationRequestContext,
    startedAt: number,
    errorCode: string,
  ): Promise<RecommendProductsResponseDto> {
    let groundedProducts: RecommendationGroundedProduct[];

    try {
      groundedProducts = await this.loadGroundedProducts(
        candidates.map((candidate) => candidate.productId),
        request,
      );
    } catch {
      throw errorCode === 'AI_DISABLED'
        ? new ServiceUnavailableException({
            code: 'AI_DISABLED',
            message: 'Product recommendations are disabled.',
          })
        : this.aiUnavailableException();
    }

    const groundedById = new Map(
      groundedProducts.map((product) => [product.productId, product]),
    );
    const recommendations = candidates
      .map((candidate) => groundedById.get(candidate.productId))
      .filter(
        (product): product is RecommendationGroundedProduct =>
          Boolean(product),
      )
      .slice(0, request.limit)
      .map((product) => ({
        ...product,
        reason: 'This currently available product matches the filters you provided.',
      }));
    const hasRecommendations = recommendations.length > 0;
    const response: RecommendProductsResponseDto = {
      mode: 'catalog_fallback',
      summary: hasRecommendations
        ? 'Here are currently available products that match your filters.'
        : 'No matching in-stock products were found for the applied filters.',
      appliedFilters: this.buildAppliedFilters(request),
      recommendations,
      noMatchSuggestions: hasRecommendations
        ? []
        : this.buildNoMatchSuggestions(request),
    };

    this.logEvent('AI_RECOMMEND_PRODUCTS_FALLBACK', context, {
      mode: response.mode,
      candidateCount: candidates.length,
      resultCount: recommendations.length,
      latencyMs: Date.now() - startedAt,
      errorCode,
    });

    return response;
  }

  private buildOutOfScopeResponse(
    request: NormalizedRecommendProductsRequest,
    locale: AiScopeLocale,
  ): RecommendProductsResponseDto {
    return {
      mode: 'out_of_scope',
      summary:
        locale === 'vi'
          ? 'Mình có thể gợi ý sản phẩm Belikeme theo phong cách, ngân sách, màu sắc, size hoặc dịp sử dụng. Bạn thử mô tả món đồ hay outfit đang cần nhé.'
          : 'I can recommend Belikeme products based on your style, budget, color, size, or occasion. Try describing the type of outfit or item you want.',
      appliedFilters: this.buildAppliedFilters(request),
      recommendations: [],
      noMatchSuggestions:
        locale === 'vi'
          ? [
              'Thử hỏi: Gợi ý outfit màu đen dưới 500k.',
              'Thử hỏi: Tìm áo form rộng hoặc đồ tối giản.',
            ]
          : [
              'Try asking for a black outfit under 500k.',
              'Try asking for oversized shirts or minimal pieces.',
            ],
    };
  }

  private async loadGroundedProducts(
    productIds: string[],
    request: NormalizedRecommendProductsRequest,
  ): Promise<RecommendationGroundedProduct[]> {
    const uniqueProductIds = Array.from(new Set(productIds));

    if (uniqueProductIds.length === 0) {
      return [];
    }

    const variantWhere = this.buildVariantWhere(request);
    const products = await this.prismaService.product.findMany({
      where: this.buildProductWhere(
        request,
        variantWhere,
        uniqueProductIds,
      ),
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrls: true,
        basePrice: true,
        variants: {
          where: {
            isActive: true,
            stock: {
              gt: 0,
            },
          },
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
          select: {
            size: true,
            color: true,
            priceOverride: true,
          },
        },
      },
    });

    return (products satisfies AiRecommendationGroundedProductRecord[])
      .map((product) =>
        this.aiContextMapper.mapRecommendationGroundedProduct(
          product,
          request,
        ),
      )
      .filter(
        (product): product is RecommendationGroundedProduct =>
          Boolean(product),
      );
  }

  private buildVariantWhere(
    request: NormalizedRecommendProductsRequest,
  ): Prisma.ProductVariantWhereInput {
    return {
      isActive: true,
      stock: {
        gt: 0,
      },
      ...(request.colors.length > 0
        ? {
            color: {
              in: request.colors,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(request.sizes.length > 0
        ? {
            size: {
              in: request.sizes,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };
  }

  private buildProductWhere(
    request: NormalizedRecommendProductsRequest,
    variantWhere: Prisma.ProductVariantWhereInput,
    productIds?: string[],
  ): Prisma.ProductWhereInput {
    const andFilters: Prisma.ProductWhereInput[] = [];

    if (request.categorySlugs.length > 0) {
      const categorySlugFilter = {
        in: request.categorySlugs,
        mode: 'insensitive' as const,
      };

      andFilters.push({
        OR: [
          {
            category: {
              isActive: true,
              slug: categorySlugFilter,
            },
          },
          {
            productCategories: {
              some: {
                category: {
                  isActive: true,
                  slug: categorySlugFilter,
                },
              },
            },
          },
        ],
      });
    }

    const budgetWhere = this.buildBudgetWhere(request, variantWhere);

    if (budgetWhere) {
      andFilters.push(budgetWhere);
    }

    return {
      ...(productIds ? { id: { in: productIds } } : {}),
      isActive: true,
      category: {
        isActive: true,
      },
      variants: {
        some: variantWhere,
      },
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };
  }

  private buildBudgetWhere(
    request: NormalizedRecommendProductsRequest,
    variantWhere: Prisma.ProductVariantWhereInput,
  ): Prisma.ProductWhereInput | undefined {
    if (request.minBudget === undefined && request.maxBudget === undefined) {
      return undefined;
    }

    const priceBounds = {
      ...(request.minBudget !== undefined ? { gte: request.minBudget } : {}),
      ...(request.maxBudget !== undefined ? { lte: request.maxBudget } : {}),
    };

    return {
      OR: [
        {
          variants: {
            some: {
              ...variantWhere,
              priceOverride: {
                not: null,
                ...priceBounds,
              },
            },
          },
        },
        {
          basePrice: priceBounds,
          variants: {
            some: {
              ...variantWhere,
              priceOverride: null,
            },
          },
        },
      ],
    };
  }

  private buildAppliedFilters(
    request: NormalizedRecommendProductsRequest,
  ): RecommendProductsAppliedFiltersDto {
    return {
      ...(request.minBudget !== undefined
        ? { minBudget: request.minBudget }
        : {}),
      ...(request.maxBudget !== undefined
        ? { maxBudget: request.maxBudget }
        : {}),
      categorySlugs: request.categorySlugs,
      colors: request.colors,
      sizes: request.sizes,
      activeOnly: true,
      inStockOnly: true,
    };
  }

  private buildNoMatchSuggestions(
    request: NormalizedRecommendProductsRequest,
  ): string[] {
    const suggestions: string[] = [];

    if (request.maxBudget !== undefined) {
      suggestions.push('Try increasing your max budget.');
    }

    if (request.minBudget !== undefined) {
      suggestions.push('Try lowering your minimum budget.');
    }

    if (request.colors.length > 0) {
      suggestions.push('Try removing one color filter.');
    }

    if (request.sizes.length > 0) {
      suggestions.push('Try another size.');
    }

    if (request.categorySlugs.length > 0) {
      suggestions.push('Try another category.');
    }

    suggestions.push('Browse all active products.');

    return suggestions.slice(0, 4);
  }

  private normalizeArray(
    values: string[] | undefined,
    fieldName: string,
    normalize: (value: string) => string,
  ): string[] {
    if (values === undefined) {
      return [];
    }

    if (!Array.isArray(values) || values.length > MAX_FILTER_VALUES) {
      throw this.invalidRequestException(
        `${fieldName} must contain at most 5 values.`,
      );
    }

    return values.map((value) => normalize(value));
  }

  private normalizeUserText(value: string, fieldName: string): string {
    if (
      typeof value !== 'string' ||
      DISALLOWED_CONTROL_CHARACTERS.test(value)
    ) {
      throw this.invalidRequestException(
        `${fieldName} contains unsupported characters.`,
      );
    }

    const normalized = value.trim().replace(/[ \t\r\n]+/g, ' ');

    if (!normalized) {
      throw this.invalidRequestException(`${fieldName} cannot be empty.`);
    }

    return normalized;
  }

  private normalizeSlug(value: string): string {
    const normalized = this.normalizeUserText(value, 'categorySlugs')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw this.invalidRequestException(
        'categorySlugs cannot contain empty values.',
      );
    }

    return normalized;
  }

  private assertBudget(value: number | undefined, fieldName: string) {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0 || value > MAX_VND_AMOUNT)
    ) {
      throw this.invalidRequestException(`${fieldName} is invalid.`);
    }
  }

  private assertDistinctValues(values: string[], fieldName: string) {
    const comparableValues = values.map((value) =>
      value.toLocaleLowerCase(),
    );

    if (new Set(comparableValues).size !== comparableValues.length) {
      throw this.invalidRequestException(
        `${fieldName} cannot contain duplicates.`,
      );
    }
  }

  private invalidRequestException(message: string): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_RECOMMEND_PRODUCTS_REQUEST',
      message,
    });
  }

  private aiUnavailableException(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'AI_UNAVAILABLE',
      message: 'Product recommendations are temporarily unavailable.',
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
    context: ProductRecommendationRequestContext,
    fields: {
      mode?: RecommendProductsResponseDto['mode'];
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
