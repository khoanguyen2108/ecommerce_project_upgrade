import { Injectable } from '@nestjs/common';

const MAX_PROVIDER_CONTENT_LENGTH = 16 * 1024;
const MAX_SUMMARY_LENGTH = 600;
const MAX_RECOMMENDATION_TEXT_LENGTH = 240;
const MAX_RECOMMENDATIONS = 4;
const MAX_EXTRA_TIPS = 4;
const HTML_PATTERN = /<\/?[a-z][^>]*>/i;
const MARKDOWN_PATTERN =
  /```|`[^`]+`|\[[^\]]+\]\([^)]+\)|(^|\n)\s{0,3}(?:#{1,6}\s|>\s|[-*+]\s|\d+\.\s)|\*\*[^*]+\*\*|__[^_]+__/m;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const ALIAS_IN_PROSE_PATTERN = /\bP\d+\b/i;

export interface ValidatedAiRecommendation {
  ref: string;
  reason: string;
  stylingTip?: string;
}

export interface ValidatedStyleAdviceOutput {
  summary: string;
  recommendations: ValidatedAiRecommendation[];
  extraTips: string[];
}

export class AiOutputValidationError extends Error {
  constructor() {
    super('AI response validation failed.');
    this.name = 'AiOutputValidationError';
  }
}

@Injectable()
export class AiOutputValidator {
  validateStyleAdvice(
    content: string,
    allowedRefs: ReadonlySet<string>,
  ): ValidatedStyleAdviceOutput {
    const trimmedContent = content.trim();

    if (
      !trimmedContent ||
      trimmedContent.length > MAX_PROVIDER_CONTENT_LENGTH ||
      trimmedContent.startsWith('```') ||
      HTML_PATTERN.test(trimmedContent)
    ) {
      throw new AiOutputValidationError();
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(trimmedContent);
    } catch {
      throw new AiOutputValidationError();
    }

    if (!this.isRecord(parsed) || !this.hasOnlyKeys(parsed, [
      'summary',
      'recommendations',
      'extraTips',
    ])) {
      throw new AiOutputValidationError();
    }

    if (
      !Array.isArray(parsed.recommendations) ||
      parsed.recommendations.length > MAX_RECOMMENDATIONS ||
      !Array.isArray(parsed.extraTips) ||
      parsed.extraTips.length > MAX_EXTRA_TIPS
    ) {
      throw new AiOutputValidationError();
    }

    const summary = this.validatePlainText(parsed.summary, MAX_SUMMARY_LENGTH);
    const recommendations: ValidatedAiRecommendation[] = [];
    const seenRefs = new Set<string>();

    for (const recommendation of parsed.recommendations) {
      if (
        !this.isRecord(recommendation) ||
        !this.hasOnlyKeys(recommendation, [
          'ref',
          'reason',
          'stylingTip',
        ]) ||
        typeof recommendation.ref !== 'string'
      ) {
        throw new AiOutputValidationError();
      }

      const ref = recommendation.ref.trim();
      const reason = this.validatePlainText(
        recommendation.reason,
        MAX_RECOMMENDATION_TEXT_LENGTH,
      );
      const stylingTip =
        recommendation.stylingTip === undefined
          ? undefined
          : this.validatePlainText(
              recommendation.stylingTip,
              MAX_RECOMMENDATION_TEXT_LENGTH,
            );

      if (!allowedRefs.has(ref) || seenRefs.has(ref)) {
        continue;
      }

      seenRefs.add(ref);
      recommendations.push({
        ref,
        reason,
        ...(stylingTip ? { stylingTip } : {}),
      });
    }

    const extraTips = parsed.extraTips.map((tip) =>
      this.validatePlainText(tip, MAX_RECOMMENDATION_TEXT_LENGTH),
    );

    return { summary, recommendations, extraTips };
  }

  private validatePlainText(value: unknown, maxLength: number): string {
    if (typeof value !== 'string') {
      throw new AiOutputValidationError();
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    if (
      !normalized ||
      normalized.length > maxLength ||
      HTML_PATTERN.test(normalized) ||
      MARKDOWN_PATTERN.test(normalized) ||
      URL_PATTERN.test(normalized) ||
      ALIAS_IN_PROSE_PATTERN.test(normalized)
    ) {
      throw new AiOutputValidationError();
    }

    return normalized;
  }

  private hasOnlyKeys(
    value: Record<string, unknown>,
    allowedKeys: string[],
  ): boolean {
    const allowed = new Set(allowedKeys);
    return Object.keys(value).every((key) => allowed.has(key));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
