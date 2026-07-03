import { Injectable } from '@nestjs/common';
import type { AiConversationMessage } from '../chat/chat.service';
import { ChatSenderRole } from '../generated/prisma/enums';
import type {
  ConversationMemoryDto,
  ConversationProductDto,
} from './dto/support.dto';

const RESET_MEMORY_PATTERN =
  /\b(?:reset (?:my )?(?:preferences|memory)|forget (?:my )?(?:preferences|choices|shopping preferences)|clear (?:my )?(?:preferences|memory)|start over)\b|\b(?:xoa|dat lai) (?:so thich|bo nho)\b/i;
const FIT_VALUES = ['oversized', 'regular', 'slim'] as const;
const STYLE_VALUES = [
  'vintage',
  'minimal',
  'streetwear',
  'casual',
  'formal',
  'sporty',
  'classic',
  'smart casual',
  'preppy',
] as const;
const OCCASION_VALUES = [
  'wedding',
  'work',
  'office',
  'party',
  'school',
  'date',
  'travel',
  'gym',
  'weekend',
] as const;
const COLOR_VALUES = [
  'black',
  'white',
  'grey',
  'gray',
  'navy',
  'blue',
  'red',
  'green',
  'beige',
  'brown',
  'pink',
  'purple',
  'yellow',
  'orange',
  'cream',
] as const;

export interface AiSizeProfile {
  heightCm?: number;
  weightKg?: number;
}

export type AiPendingIntent = 'SIZE_RECOMMENDATION' | 'PRODUCT_COMPARISON';

@Injectable()
export class AiConversationMemoryService {
  build(
    messages: AiConversationMessage[],
    currentMessage: string,
  ): {
    memory: ConversationMemoryDto;
    pendingIntent?: AiPendingIntent;
    sizeProfile: AiSizeProfile;
    reset: boolean;
  } {
    const reset = RESET_MEMORY_PATTERN.test(currentMessage);

    if (reset) {
      return {
        memory: { lastSelectedProducts: [] },
        sizeProfile: {},
        reset: true,
      };
    }

    const relevantMessages = this.afterLastReset(messages);
    const customerMessages = relevantMessages
      .filter((message) => message.senderRole === ChatSenderRole.CUSTOMER)
      .map((message) => message.body)
      .concat(currentMessage);
    const memory: ConversationMemoryDto = {
      lastSelectedProducts: this.readSelectedProducts(relevantMessages),
    };
    const sizeProfile: AiSizeProfile = {};

    for (const message of customerMessages) {
      this.applyPreferences(memory, message);
      this.applySizeProfile(sizeProfile, message);
    }

    return {
      memory,
      pendingIntent: this.getPendingIntent(messages),
      sizeProfile,
      reset: false,
    };
  }

  getPendingIntent(messages: AiConversationMessage[]): AiPendingIntent | undefined {
    const relevantMessages = this.afterLastReset(messages);

    for (const message of [...relevantMessages].reverse()) {
      if (message.senderRole !== ChatSenderRole.AI || !this.isRecord(message.metadata)) {
        continue;
      }

      const sizeRecommendation = message.metadata.sizeRecommendation;
      const comparison = message.metadata.comparison;

      if (
        this.isRecord(sizeRecommendation) &&
        sizeRecommendation.status === 'needs_information'
      ) {
        return 'SIZE_RECOMMENDATION';
      }

      if (this.isRecord(comparison) && comparison.status === 'needs_information') {
        return 'PRODUCT_COMPARISON';
      }

      return undefined;
    }

    return undefined;
  }

  withSelectedProducts(
    memory: ConversationMemoryDto,
    products: ConversationProductDto[],
  ): ConversationMemoryDto {
    const bySlug = new Map<string, ConversationProductDto>();

    for (const product of [...memory.lastSelectedProducts, ...products]) {
      bySlug.set(product.slug, product);
    }

    return {
      ...memory,
      lastSelectedProducts: [...bySlug.values()].slice(-5),
    };
  }

  hasRememberedPreferences(memory: ConversationMemoryDto): boolean {
    return Boolean(
      memory.budget ||
        memory.preferredStyle ||
        memory.preferredFit ||
        memory.occasion ||
        memory.genderPreference ||
        memory.favoriteColor ||
        memory.lastSelectedProducts.length > 0,
    );
  }

  private afterLastReset(messages: AiConversationMessage[]) {
    let lastResetIndex = -1;

    messages.forEach((message, index) => {
      if (
        message.senderRole === ChatSenderRole.CUSTOMER &&
        RESET_MEMORY_PATTERN.test(message.body)
      ) {
        lastResetIndex = index;
      }
    });

    return messages.slice(lastResetIndex + 1);
  }

  private applyPreferences(memory: ConversationMemoryDto, message: string) {
    const budget = this.extractBudget(message);

    if (budget) {
      memory.budget = budget;
    }

    const normalized = message.toLocaleLowerCase();
    const preferenceSignal =
      /\b(?:prefer|favorite|favourite|like|love|want|need|looking for|show me|my style|usually wear)\b/.test(
        normalized,
      );
    const fit = FIT_VALUES.find((value) => this.containsWord(normalized, value));
    const style = STYLE_VALUES.find((value) => this.containsWord(normalized, value));
    const occasion = OCCASION_VALUES.find((value) =>
      this.containsWord(normalized, value),
    );
    const color = COLOR_VALUES.find((value) => this.containsWord(normalized, value));

    if (
      fit &&
      (preferenceSignal ||
        new RegExp(`\\b${fit}\\s+fit\\b|\\bwear\\s+${fit}\\b`, 'i').test(
          normalized,
        ))
    ) {
      memory.preferredFit = fit;
    }

    if (style && preferenceSignal) {
      memory.preferredStyle = style;
    }

    if (
      occasion &&
      new RegExp(`\\b(?:for|to|at)\\s+(?:the\\s+)?${occasion}\\b`, 'i').test(
        normalized,
      )
    ) {
      memory.occasion = occasion === 'office' ? 'work' : occasion;
    }

    if (
      color &&
      (preferenceSignal ||
        new RegExp(`\\b${color}\\s+(?:one|ones|color|colour)\\b`, 'i').test(
          normalized,
        ))
    ) {
      memory.favoriteColor = color === 'gray' ? 'grey' : color;
    }

    const genderPreference = this.extractGenderPreference(normalized);

    if (genderPreference) {
      memory.genderPreference = genderPreference;
    }
  }

  private extractBudget(message: string): ConversationMemoryDto['budget'] {
    const normalized = message.toLocaleLowerCase();
    const match = normalized.match(
      /(?:\b(?:under|below|maximum|max|budget(?:\s+is|\s+of)?|up to)\s*)?(\$|usd\s*)?(\d+(?:\.\d+)?)\s*(k|m|usd|vnd)?\b/,
    );

    if (!match) {
      return undefined;
    }

    const hasBudgetSignal =
      /\b(?:under|below|maximum|max|budget|up to)\b/.test(normalized) ||
      Boolean(match[1]) ||
      Boolean(match[3]);

    if (!hasBudgetSignal) {
      return undefined;
    }

    const rawAmount = Number(match[2]);

    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return undefined;
    }

    const unit = match[3];
    const currency = match[1] || unit === 'usd' ? 'USD' : 'VND';
    const multiplier = unit === 'k' ? 1_000 : unit === 'm' ? 1_000_000 : 1;
    const amount = rawAmount * multiplier;

    if (!Number.isSafeInteger(amount)) {
      return undefined;
    }

    return { amount, currency };
  }

  private extractGenderPreference(message: string): string | undefined {
    const excludesWomen =
      /\b(?:not|no|exclude|without)\s+(?:women|women's|female)\b/.test(message);
    const excludesMen =
      /\b(?:not|no|exclude|without)\s+(?:men|men's|male)\b/.test(message);

    if (
      !excludesWomen &&
      /\b(?:for|prefer|show me)\s+(?:women|women's|female)\b|\bwomen's\b/.test(
        message,
      )
    ) {
      return 'women';
    }

    if (
      !excludesMen &&
      /\b(?:for|prefer|show me)\s+(?:men|men's|male)\b|\bmen's\b/.test(
        message,
      )
    ) {
      return 'men';
    }

    if (/\b(?:prefer|show me|for)\s+unisex\b/.test(message)) {
      return 'unisex';
    }

    return undefined;
  }

  private applySizeProfile(profile: AiSizeProfile, message: string) {
    const heightCm = this.extractHeightCm(message);
    const weightKg = this.extractWeightKg(message);

    if (heightCm) {
      profile.heightCm = heightCm;
    }

    if (weightKg) {
      profile.weightKg = weightKg;
    }
  }

  private extractHeightCm(message: string): number | undefined {
    const centimeters = message.match(/\b(1\d{2}|2[0-4]\d)\s*cm\b/i);

    if (centimeters) {
      return Number(centimeters[1]);
    }

    const meters = message.match(/\b(1(?:\.\d{1,2})|2(?:\.\d{1,2}))\s*m\b/i);

    if (meters) {
      return Math.round(Number(meters[1]) * 100);
    }

    const imperial = message.match(/\b([4-7])\s*(?:ft|')\s*(\d{1,2})?\s*(?:in|")?/i);

    if (imperial) {
      const inches = Number(imperial[1]) * 12 + Number(imperial[2] ?? 0);
      return Math.round(inches * 2.54);
    }

    return undefined;
  }

  private extractWeightKg(message: string): number | undefined {
    const kilograms = message.match(/\b(3\d|[4-9]\d|1\d{2}|2[0-4]\d)\s*kg\b/i);

    if (kilograms) {
      return Number(kilograms[1]);
    }

    const pounds = message.match(/\b(6\d|[7-9]\d|1\d{2}|2\d{2}|3[0-9]\d|400)\s*(?:lb|lbs)\b/i);

    if (pounds) {
      return Math.round(Number(pounds[1]) * 0.453592 * 10) / 10;
    }

    return undefined;
  }

  private readSelectedProducts(
    messages: AiConversationMessage[],
  ): ConversationProductDto[] {
    const products = new Map<string, ConversationProductDto>();

    for (const message of messages) {
      if (message.senderRole !== ChatSenderRole.AI || !this.isRecord(message.metadata)) {
        continue;
      }

      const sizeRecommendation = message.metadata.sizeRecommendation;
      const comparison = message.metadata.comparison;

      if (this.isRecord(sizeRecommendation)) {
        this.addProduct(products, sizeRecommendation.product);
      }

      if (this.isRecord(comparison)) {
        this.addProduct(products, comparison.productA);
        this.addProduct(products, comparison.productB);
      }
    }

    return [...products.values()].slice(-5);
  }

  private addProduct(
    products: Map<string, ConversationProductDto>,
    value: unknown,
  ) {
    if (
      this.isRecord(value) &&
      typeof value.name === 'string' &&
      typeof value.slug === 'string'
    ) {
      products.set(value.slug, { name: value.name, slug: value.slug });
    }
  }

  private containsWord(message: string, value: string): boolean {
    return new RegExp(`\\b${value.replace(/\s+/g, '\\s+')}\\b`, 'i').test(message);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
