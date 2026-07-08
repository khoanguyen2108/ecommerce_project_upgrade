import { Injectable } from '@nestjs/common';
import type { AiConversationMessage } from '../chat/chat.service';
import { ChatSenderRole } from '../generated/prisma/enums';
import type { ConversationMemoryDto } from './dto/support.dto';

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

@Injectable()
export class AiConversationMemoryService {
  build(
    messages: AiConversationMessage[],
    currentMessage: string,
  ): {
    memory: ConversationMemoryDto;
    reset: boolean;
  } {
    const reset = RESET_MEMORY_PATTERN.test(currentMessage);

    if (reset) {
      return {
        memory: { lastSelectedProducts: [] },
        reset: true,
      };
    }

    const relevantMessages = this.afterLastReset(messages);
    const customerMessages = relevantMessages
      .filter((message) => message.senderRole === ChatSenderRole.CUSTOMER)
      .map((message) => message.body)
      .concat(currentMessage);
    const memory: ConversationMemoryDto = {
      lastSelectedProducts: [],
    };

    for (const message of customerMessages) {
      this.applyPreferences(memory, message);
    }

    return {
      memory,
      reset: false,
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

  private containsWord(message: string, value: string): boolean {
    return new RegExp(`\\b${value.replace(/\s+/g, '\\s+')}\\b`, 'i').test(message);
  }
}
