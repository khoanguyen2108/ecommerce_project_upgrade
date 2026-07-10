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
  StyleAdviceRequestDto,
  StyleAdviceResponseDto,
} from './dto/style-advice.dto';
import { OutfitRecommendationService } from './outfit-recommendation.service';
import { inferBudgetFromStylePrompt } from './style-advice-fallback';
import { detectStyleAdviceLocale } from './style-advice-locale';

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

        const response: StyleAdviceResponseDto = {
          mode: 'deterministic_tag_recommender',
          locale,
          ...result.response,
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

  private buildOutOfScopeResponse(
    request: NormalizedStyleAdviceRequest,
    locale: AiScopeLocale,
  ): StyleAdviceResponseDto {
    const query = [
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
      mode: 'out_of_scope',
      locale,
      query,
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
      recommendations: [],
      extraTips: tips,
      warnings: [],
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
