import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_AI_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_AI_TIMEOUT_MS = 15_000;
const DEFAULT_AI_MAX_TOKENS = 700;
const DEFAULT_AI_TEMPERATURE = 0.4;

export interface AiRuntimeConfig {
  enabled: boolean;
  provider: string;
  apiKey: string | undefined;
  model: string | undefined;
  baseUrl: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

@Injectable()
export class AiConfigService {
  private readonly config: AiRuntimeConfig;

  constructor(configService: ConfigService) {
    this.config = {
      enabled: configService.get<string>('AI_ENABLED')?.trim().toLowerCase() === 'true',
      provider:
        configService.get<string>('AI_PROVIDER')?.trim().toLowerCase() ||
        'openrouter',
      apiKey: this.getOptionalSecret(configService, 'OPENROUTER_API_KEY'),
      model: this.getOptionalText(configService, 'AI_MODEL'),
      baseUrl: this.parseBaseUrl(
        configService.get<string>('AI_BASE_URL')?.trim() || DEFAULT_AI_BASE_URL,
      ),
      timeoutMs: this.parseBoundedNumber(
        configService,
        'AI_TIMEOUT_MS',
        DEFAULT_AI_TIMEOUT_MS,
        1_000,
        30_000,
        true,
      ),
      maxTokens: this.parseBoundedNumber(
        configService,
        'AI_MAX_TOKENS',
        DEFAULT_AI_MAX_TOKENS,
        100,
        1_200,
        true,
      ),
      temperature: this.parseBoundedNumber(
        configService,
        'AI_TEMPERATURE',
        DEFAULT_AI_TEMPERATURE,
        0,
        1,
        false,
      ),
    };
  }

  getRuntimeConfig(): Readonly<AiRuntimeConfig> {
    return this.config;
  }

  isConfigured(): boolean {
    return (
      this.config.provider === 'openrouter' &&
      Boolean(this.config.apiKey) &&
      Boolean(this.config.model)
    );
  }

  private getOptionalSecret(
    configService: ConfigService,
    key: string,
  ): string | undefined {
    const value = configService.get<string>(key)?.trim();
    return value || undefined;
  }

  private getOptionalText(
    configService: ConfigService,
    key: string,
  ): string | undefined {
    const value = configService.get<string>(key)?.trim();
    return value || undefined;
  }

  private parseBoundedNumber(
    configService: ConfigService,
    key: string,
    defaultValue: number,
    minimum: number,
    maximum: number,
    integerOnly: boolean,
  ): number {
    const rawValue = configService.get<string | number>(key);

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return defaultValue;
    }

    const value = Number(rawValue);
    const validInteger = !integerOnly || Number.isInteger(value);

    if (
      !Number.isFinite(value) ||
      !validInteger ||
      value < minimum ||
      value > maximum
    ) {
      throw new Error(
        `${key} must be ${integerOnly ? 'an integer' : 'a number'} between ${minimum} and ${maximum}.`,
      );
    }

    return value;
  }

  private parseBaseUrl(value: string): string {
    const normalized = value.trim().replace(/\/+$/, '');

    try {
      const url = new URL(normalized);

      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'openrouter.ai' ||
        url.search ||
        url.hash
      ) {
        throw new Error('Unsupported AI base URL.');
      }

      return normalized;
    } catch {
      throw new Error('AI_BASE_URL must be an approved OpenRouter HTTPS URL.');
    }
  }
}
