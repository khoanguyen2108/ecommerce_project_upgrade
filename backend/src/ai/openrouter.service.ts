import { Injectable } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import {
  RECOMMEND_PRODUCTS_SYSTEM_PROMPT,
  buildRecommendProductsUserPrompt,
} from './prompts/recommend-products.prompt';
import {
  STYLE_ADVICE_SYSTEM_PROMPT,
  buildStyleAdviceUserPrompt,
} from './prompts/style-advice.prompt';
import type { AiCatalogContextProduct } from './ai-context.mapper';
import type { NormalizedRecommendProductsRequest } from './dto/recommend-products.dto';
import type { NormalizedStyleAdviceRequest } from './dto/style-advice.dto';

const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;

export type AiProviderErrorCode =
  | 'AI_PROVIDER_BUSY'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE';

export class AiProviderError extends Error {
  constructor(readonly code: AiProviderErrorCode) {
    super(code);
    this.name = 'AiProviderError';
  }
}

@Injectable()
export class OpenRouterService {
  constructor(private readonly aiConfigService: AiConfigService) {}

  async requestStyleAdvice(
    request: NormalizedStyleAdviceRequest,
    catalog: AiCatalogContextProduct[],
  ): Promise<string> {
    return this.requestCompletion(
      STYLE_ADVICE_SYSTEM_PROMPT,
      buildStyleAdviceUserPrompt(request, catalog),
    );
  }

  async requestProductRecommendations(
    request: NormalizedRecommendProductsRequest,
    catalog: AiCatalogContextProduct[],
  ): Promise<string> {
    return this.requestCompletion(
      RECOMMEND_PRODUCTS_SYSTEM_PROMPT,
      buildRecommendProductsUserPrompt(request, catalog),
    );
  }

  private async requestCompletion(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const config = this.aiConfigService.getRuntimeConfig();

    if (!config.apiKey || !config.model) {
      throw new AiProviderError('AI_UNAVAILABLE');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          provider: {
            data_collection: 'deny',
          },
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new AiProviderError('AI_PROVIDER_BUSY');
      }

      if (!response.ok) {
        throw new AiProviderError('AI_UNAVAILABLE');
      }

      const responseText = await response.text();

      if (
        !responseText ||
        Buffer.byteLength(responseText, 'utf8') > MAX_PROVIDER_RESPONSE_BYTES
      ) {
        throw new AiProviderError('AI_INVALID_RESPONSE');
      }

      let payload: unknown;

      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new AiProviderError('AI_INVALID_RESPONSE');
      }

      const content = this.extractContent(payload);

      if (!content) {
        throw new AiProviderError('AI_INVALID_RESPONSE');
      }

      return content;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }

      throw new AiProviderError('AI_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractContent(payload: unknown): string | undefined {
    if (!this.isRecord(payload) || !Array.isArray(payload.choices)) {
      return undefined;
    }

    const firstChoice = payload.choices[0];

    if (!this.isRecord(firstChoice) || !this.isRecord(firstChoice.message)) {
      return undefined;
    }

    if (
      firstChoice.finish_reason === 'length' ||
      typeof firstChoice.message.content !== 'string'
    ) {
      return undefined;
    }

    return firstChoice.message.content;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
