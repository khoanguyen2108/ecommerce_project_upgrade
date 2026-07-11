import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiQuotaService } from './ai-quota.service';
import { AiScopeService, type AiScopeLocale } from './ai-scope.service';
import type {
  NormalizedStyleAdviceRequest,
  StyleAdviceCanonicalOutfitDto,
  StyleAdviceOutfitDto,
  StyleAdviceRequestDto,
  StyleAdviceResponseDto,
} from './dto/style-advice.dto';
import { OutfitRecommendationService } from './outfit-recommendation.service';
import { inferBudgetFromStylePrompt } from './style-advice-fallback';
import { detectStyleAdviceLocale } from './style-advice-locale';

const MAX_TOTAL_USER_TEXT_LENGTH = 800;
const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const VAGUE_STYLE_PROMPTS = new Set([
  'di choi',
  'cho tui outfit',
  'cho toi outfit',
  'mac gi dep',
  'phoi do cho tui',
  'recommend outfit',
  'style me',
  'give me an outfit',
  'what should i wear',
]);

export interface StyleAdviceRequestContext {
  requestId?: string;
  userId: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly aiScopeService: AiScopeService,
    private readonly aiQuotaService: AiQuotaService,
    private readonly outfitRecommendationService: OutfitRecommendationService,
  ) {}

  async getStyleAdvice(
    dto: StyleAdviceRequestDto,
    context: StyleAdviceRequestContext,
  ): Promise<StyleAdviceResponseDto> {
    const startedAt = Date.now();
    let candidateCount = 0;
    let resultCount = 0;

    this.logEvent('AI_STYLE_ADVICE_REQUESTED', context, {
      candidateCount,
      resultCount,
      latencyMs: 0,
    });

    try {
      const request = this.normalizeRequest(dto);
      const locale = detectStyleAdviceLocale(request);
      const scopeDecision = this.aiScopeService.evaluateStyleAdvice(request);

      this.aiScopeService.logDecision(
        '/ai/style-advice',
        scopeDecision,
        context,
      );

      if (scopeDecision.result !== 'allowed') {
        return this.buildOutOfScopeResponse(request, scopeDecision.locale);
      }

      if (this.needsClarification(request)) {
        return this.buildClarificationResponse(request, locale);
      }

      const quotaLease = await this.aiQuotaService.acquire(
        'style-advice',
        context.userId,
      );

      try {
        const result =
          await this.outfitRecommendationService.recommendOutfits(
            request,
            locale,
          );
        candidateCount = result.candidateCount;
        resultCount = result.resultCount;

        const legacyResponse = result.response;
        const canonicalOutfit = this.buildCanonicalOutfit(
          legacyResponse.outfits[0],
          legacyResponse.summary,
          legacyResponse.warnings,
        );
        const missingContext =
          legacyResponse.refinement?.applied === false &&
          legacyResponse.outfits.length === 0;
        const response: StyleAdviceResponseDto = {
          type: missingContext ? 'clarification' : 'outfit',
          mode: 'deterministic_tag_recommender',
          locale,
          ...(request.budget !== undefined ? { budget: request.budget } : {}),
          ...legacyResponse,
          message: legacyResponse.summary,
          ...(missingContext
            ? { clarificationQuestion: legacyResponse.summary }
            : {}),
          ...(canonicalOutfit ? { outfit: canonicalOutfit } : {}),
        };

        this.logEvent('AI_STYLE_ADVICE_RECOMMENDED', context, {
          mode: response.mode,
          candidateCount,
          resultCount,
          latencyMs: Date.now() - startedAt,
        });

        return response;
      } catch {
        throw this.aiUnavailableException();
      } finally {
        await this.aiQuotaService.release(quotaLease);
      }
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
      ...(dto.message
        ? { message: this.normalizeUserText(dto.message) }
        : {}),
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
      ...this.normalizeCurrentOutfitContext(dto),
    };

    const inferredBudget = inferBudgetFromStylePrompt(request);

    if (request.budget === undefined && inferredBudget !== undefined) {
      request.budget = inferredBudget;
    }

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
      request.message,
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
      Boolean(request.message) ||
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

  private buildOutOfScopeResponse(
    request: NormalizedStyleAdviceRequest,
    locale: AiScopeLocale,
  ): StyleAdviceResponseDto {
    const query = request.message ?? [
      request.occasion,
      request.style,
      request.bodyType,
      request.notes,
      ...request.preferredColors,
      ...request.preferredSizes,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const summary =
      locale === 'vi'
        ? 'Minh co the ho tro ban ve outfit, cach phoi do va lua chon quan ao Belikeme. Hay thu cho minh biet dip, mau sac, kieu dang hoac phong cach ban thich nhe.'
        : 'I can help with Belikeme outfits, styling ideas, and clothing choices. Try asking what to wear for an event, a color, a fit, or a style you like.';
    const tips =
      locale === 'vi'
        ? [
            'Vi du: Goi y outfit toi gian mau den de di choi.',
            'Vi du: Minh nen mac gi di hoc voi ngan sach duoi 500k?',
          ]
        : [
            'Example: Recommend a minimal black outfit for going out.',
            'Example: What should I wear for school under 500k?',
          ];

    return {
      type: 'out_of_scope',
      mode: 'out_of_scope',
      locale,
      query,
      message: summary,
      intent: {
        categories: [],
        colors: [],
        styles: [],
        occasions: [],
        fits: [],
        negativeConstraints: [],
      },
      summary,
      outfits: [],
      extraTips: tips,
      warnings: [],
    };
  }

  private needsClarification(request: NormalizedStyleAdviceRequest): boolean {
    const prompt = this.buildCustomerPrompt(request);
    return VAGUE_STYLE_PROMPTS.has(this.normalizeComparable(prompt));
  }

  private buildClarificationResponse(
    request: NormalizedStyleAdviceRequest,
    locale: 'vi' | 'en',
  ): StyleAdviceResponseDto {
    const question =
      locale === 'vi'
        ? 'B\u1ea1n mu\u1ed1n outfit cho d\u1ecbp n\u00e0o, vibe g\u00ec v\u00e0 ng\u00e2n s\u00e1ch kho\u1ea3ng bao nhi\u00eau?'
        : 'What occasion, vibe, and budget should I style this outfit for?';

    return {
      type: 'clarification',
      mode: 'deterministic_tag_recommender',
      locale,
      query: this.buildCustomerPrompt(request),
      message: question,
      clarificationQuestion: question,
      summary: question,
      intent: {
        categories: [],
        colors: [],
        styles: [],
        occasions: [],
        fits: [],
        negativeConstraints: [],
      },
      // Deprecated compatibility fields intentionally carry no products here.
      outfits: [],
      extraTips: [],
      warnings: [],
      ...(request.budget !== undefined ? { budget: request.budget } : {}),
    };
  }

  private buildCanonicalOutfit(
    outfit: StyleAdviceOutfitDto | undefined,
    summary: string,
    warnings: string[],
  ): StyleAdviceCanonicalOutfitDto | undefined {
    if (!outfit) {
      return undefined;
    }

    return {
      summary,
      totalPrice: outfit.products.reduce(
        (total, product) => total + product.price,
        0,
      ),
      items: outfit.products.map((product) => ({
        role: product.role,
        productId: product.productId,
        productSlug: product.productSlug,
        productName: product.productName,
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
        price: product.price,
        // Product-level outfit items cannot prove that size/color selection
        // is unnecessary, so V2-lite never guesses a variant.
        variantRequired: true,
      })),
      warnings: [...new Set([...warnings, ...outfit.warnings])],
    };
  }

  private buildCustomerPrompt(request: NormalizedStyleAdviceRequest): string {
    if (request.message) {
      return request.message;
    }

    return [
      request.occasion,
      request.style,
      request.bodyType,
      request.notes,
      ...request.preferredColors,
      ...request.preferredSizes,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
  }

  private normalizeComparable(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/gi, 'd')
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeUserTextArray(values: string[] | undefined): string[] {
    return (values ?? []).map((value) => this.normalizeUserText(value));
  }

  private normalizeCurrentOutfitContext(
    dto: StyleAdviceRequestDto,
  ): Pick<NormalizedStyleAdviceRequest, 'currentOutfit'> | Record<string, never> {
    if (dto.currentOutfit) {
      return { currentOutfit: this.normalizeCurrentOutfit(dto.currentOutfit) };
    }

    const outfits = dto.previousOutfits;
    if ((outfits?.length ?? 0) > 2) {
      throw this.invalidRequestException('At most two previous outfits are allowed.');
    }

    if (
      outfits &&
      new Set(outfits.map((outfit) => outfit.optionIndex)).size !== outfits.length
    ) {
      throw this.invalidRequestException(
        'Previous outfit option indexes must be unique.',
      );
    }

    const first = outfits?.[0];
    if (!first) return {};
    if (first.products.length > 6) {
      throw this.invalidRequestException(
        'Previous outfits can contain at most six products.',
      );
    }

    return {
      currentOutfit: this.normalizeCurrentOutfit({
        items: first.products.map(({ role, productId }) => ({ role, productId })),
        ...(dto.previousIntent ? { intent: dto.previousIntent } : {}),
        ...(dto.previousBudget !== undefined ? { budget: dto.previousBudget } : {}),
        ...(first.locale ? { locale: first.locale } : {}),
      }),
    };
  }

  private normalizeCurrentOutfit(
    outfit: NonNullable<StyleAdviceRequestDto['currentOutfit']>,
  ): NonNullable<NormalizedStyleAdviceRequest['currentOutfit']> {
    if (outfit.items.length > 6) {
      throw this.invalidRequestException('Current outfit can contain at most six items.');
    }

    const items = outfit.items.map((item) => ({
      role: item.role,
      productId: this.normalizeUserText(item.productId),
      ...(item.variantId
        ? { variantId: this.normalizeUserText(item.variantId) }
        : {}),
    }));
    if (new Set(items.map((item) => item.role)).size !== items.length) {
      throw this.invalidRequestException('Current outfit roles must be unique.');
    }
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      throw this.invalidRequestException('Current outfit product IDs must be unique.');
    }
    if (
      outfit.budget !== undefined &&
      (!Number.isInteger(outfit.budget) ||
        outfit.budget < 0 ||
        outfit.budget > 2_000_000_000)
    ) {
      throw this.invalidRequestException('Current outfit budget is invalid.');
    }

    return {
      items,
      ...(outfit.intent
        ? { intent: this.normalizeCurrentIntent(outfit.intent) }
        : {}),
      ...(outfit.budget !== undefined ? { budget: outfit.budget } : {}),
      ...(outfit.locale ? { locale: outfit.locale } : {}),
    };
  }

  private normalizeCurrentIntent(
    intent: NonNullable<StyleAdviceRequestDto['previousIntent']>,
  ): NonNullable<NormalizedStyleAdviceRequest['currentOutfit']>['intent'] {
    return {
      categories: this.normalizeContextArray(intent.categories),
      colors: this.normalizeContextArray(intent.colors),
      styles: this.normalizeContextArray(intent.styles),
      occasions: this.normalizeContextArray(intent.occasions),
      fits: this.normalizeContextArray(intent.fits),
      negativeConstraints: this.normalizeContextArray(
        intent.negativeConstraints,
      ),
    };
  }

  private normalizeContextArray(values: string[] | undefined): string[] {
    if ((values?.length ?? 0) > 12) {
      throw this.invalidRequestException(
        'Current outfit intent fields can contain at most twelve values.',
      );
    }

    return this.normalizeUserTextArray(values);
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
