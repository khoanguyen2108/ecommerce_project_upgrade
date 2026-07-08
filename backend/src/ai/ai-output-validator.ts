import { Injectable } from '@nestjs/common';

const MAX_PROVIDER_CONTENT_LENGTH = 16 * 1024;
const MAX_SUMMARY_LENGTH = 600;
const MAX_RECOMMENDATION_TEXT_LENGTH = 240;
const MAX_RECOMMENDATIONS = 4;
const MAX_EXTRA_TIPS = 4;
const MAX_PRODUCT_RECOMMENDATION_SUMMARY_LENGTH = 500;
const MAX_PRODUCT_RECOMMENDATIONS = 8;
const MAX_NO_MATCH_SUGGESTIONS = 4;
const MAX_NO_MATCH_SUGGESTION_LENGTH = 160;
const MAX_SUPPORT_ANSWER_LENGTH = 900;
const MAX_SUPPORT_SOURCES = 6;
const MAX_SUPPORT_HANDOFF_REASON_LENGTH = 160;
const MAX_SUPPORT_HANDOFF_MESSAGE_LENGTH = 500;
const HTML_PATTERN = /<\/?[a-z][^>]*>/i;
const MARKDOWN_PATTERN =
  /```|`[^`]+`|\[[^\]]+\]\([^)]+\)|(^|\n)\s{0,3}(?:#{1,6}\s|>\s|[-*+]\s|\d+\.\s)|\*\*[^*]+\*\*|__[^_]+__/m;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const ALIAS_IN_PROSE_PATTERN = /\bP\d+\b/i;
const SUPPORT_ALIAS_IN_PROSE_PATTERN = /\b(?:P|O)\d+\b/i;
const UNSUPPORTED_SUPPORT_ACTION_PATTERNS = [
  /\b(?:we|i|belikeme|support|admin|administrator|staff)\s+(?:will|can|shall)\s+(?:refund|cancel|change|modify|update|approve|process|guarantee|deliver|issue|provide|apply)\b/i,
  /\b(?:i|we|belikeme|support|admin|administrator|staff)(?:'ve| have| has)?\s+(?:already\s+)?(?:refunded|cancelled|canceled|changed|modified|updated|approved|processed)\b/i,
  /\b(?:admin|administrator|staff|support)\s+will\b/i,
  /\b(?:your\s+)?(?:refund|cancellation|discount|address change|payment change)\s+(?:is|was|has been|will be)\s+(?:approved|processed|completed|issued|confirmed|made)\b/i,
  /\b(?:arrive|delivery|delivered)\s+(?:by|on|within)\b/i,
  /\b(?:delivery|arrival)\s+date\s+(?:is|will be)\b/i,
];

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

export interface ValidatedProductRecommendation {
  ref: string;
  reason: string;
}

export interface ValidatedProductRecommendationsOutput {
  summary: string;
  recommendations: ValidatedProductRecommendation[];
  noMatchSuggestions: string[];
}

export interface ValidatedSupportOutput {
  answer: string;
  sourceIds: string[];
  handoff: {
    required: boolean;
    reason?: string;
    suggestedMessage?: string;
  };
}

export type ValidatedSupportIntent =
  | 'TRACK_ORDER'
  | 'RETURN_REQUEST'
  | 'CONVERSATION_MEMORY'
  | 'GENERAL_SUPPORT';

export interface ValidatedSupportRouting {
  intent: ValidatedSupportIntent;
}

export class AiOutputValidationError extends Error {
  constructor() {
    super('AI response validation failed.');
    this.name = 'AiOutputValidationError';
  }
}

@Injectable()
export class AiOutputValidator {
  validateSupportIntent(content: string): ValidatedSupportRouting {
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

    if (
      !this.isRecord(parsed) ||
      !this.hasOnlyKeys(parsed, ['intent']) ||
      (parsed.intent !== 'TRACK_ORDER' &&
        parsed.intent !== 'RETURN_REQUEST' &&
        parsed.intent !== 'CONVERSATION_MEMORY' &&
        parsed.intent !== 'GENERAL_SUPPORT')
    ) {
      throw new AiOutputValidationError();
    }

    return { intent: parsed.intent };
  }

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

  validateProductRecommendations(
    content: string,
    allowedRefs: ReadonlySet<string>,
    requestLimit: number,
  ): ValidatedProductRecommendationsOutput {
    const trimmedContent = content.trim();
    const recommendationLimit = Math.min(
      MAX_PRODUCT_RECOMMENDATIONS,
      Math.max(1, requestLimit),
    );

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

    if (
      !this.isRecord(parsed) ||
      !this.hasOnlyKeys(parsed, [
        'summary',
        'recommendations',
        'noMatchSuggestions',
      ])
    ) {
      throw new AiOutputValidationError();
    }

    if (
      !Array.isArray(parsed.recommendations) ||
      parsed.recommendations.length > recommendationLimit ||
      !Array.isArray(parsed.noMatchSuggestions) ||
      parsed.noMatchSuggestions.length > MAX_NO_MATCH_SUGGESTIONS
    ) {
      throw new AiOutputValidationError();
    }

    const summary = this.validatePlainText(
      parsed.summary,
      MAX_PRODUCT_RECOMMENDATION_SUMMARY_LENGTH,
    );
    const recommendations: ValidatedProductRecommendation[] = [];
    const seenRefs = new Set<string>();

    for (const recommendation of parsed.recommendations) {
      if (
        !this.isRecord(recommendation) ||
        !this.hasOnlyKeys(recommendation, ['ref', 'reason']) ||
        typeof recommendation.ref !== 'string'
      ) {
        throw new AiOutputValidationError();
      }

      const ref = recommendation.ref.trim();
      const reason = this.validatePlainText(
        recommendation.reason,
        MAX_RECOMMENDATION_TEXT_LENGTH,
      );

      if (!allowedRefs.has(ref) || seenRefs.has(ref)) {
        continue;
      }

      seenRefs.add(ref);
      recommendations.push({ ref, reason });
    }

    const noMatchSuggestions = parsed.noMatchSuggestions.map((suggestion) =>
      this.validatePlainText(suggestion, MAX_NO_MATCH_SUGGESTION_LENGTH),
    );

    return { summary, recommendations, noMatchSuggestions };
  }

  validateSupport(
    content: string,
    allowedSourceIds: ReadonlySet<string>,
  ): ValidatedSupportOutput {
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

    if (
      !this.isRecord(parsed) ||
      !this.hasOnlyKeys(parsed, ['answer', 'sourceIds', 'handoff']) ||
      !Array.isArray(parsed.sourceIds) ||
      parsed.sourceIds.length === 0 ||
      parsed.sourceIds.length > MAX_SUPPORT_SOURCES ||
      !this.isRecord(parsed.handoff) ||
      !this.hasOnlyKeys(parsed.handoff, [
        'required',
        'reason',
        'suggestedMessage',
      ]) ||
      typeof parsed.handoff.required !== 'boolean'
    ) {
      throw new AiOutputValidationError();
    }

    const answer = this.validateSupportPlainText(
      parsed.answer,
      MAX_SUPPORT_ANSWER_LENGTH,
    );
    const sourceIds: string[] = [];
    const seenSourceIds = new Set<string>();

    for (const sourceIdValue of parsed.sourceIds) {
      if (typeof sourceIdValue !== 'string') {
        throw new AiOutputValidationError();
      }

      const sourceId = sourceIdValue.trim();

      if (
        !sourceId ||
        !allowedSourceIds.has(sourceId) ||
        seenSourceIds.has(sourceId)
      ) {
        throw new AiOutputValidationError();
      }

      seenSourceIds.add(sourceId);
      sourceIds.push(sourceId);
    }

    const reason =
      parsed.handoff.reason === undefined
        ? undefined
        : this.validateSupportPlainText(
            parsed.handoff.reason,
            MAX_SUPPORT_HANDOFF_REASON_LENGTH,
          );
    const suggestedMessage =
      parsed.handoff.suggestedMessage === undefined
        ? undefined
        : this.validateSupportPlainText(
            parsed.handoff.suggestedMessage,
            MAX_SUPPORT_HANDOFF_MESSAGE_LENGTH,
          );

    if (parsed.handoff.required && (!reason || !suggestedMessage)) {
      throw new AiOutputValidationError();
    }

    return {
      answer,
      sourceIds,
      handoff: {
        required: parsed.handoff.required,
        ...(reason ? { reason } : {}),
        ...(suggestedMessage ? { suggestedMessage } : {}),
      },
    };
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

  private validateSupportPlainText(value: unknown, maxLength: number): string {
    const normalized = this.validatePlainText(value, maxLength);

    if (
      SUPPORT_ALIAS_IN_PROSE_PATTERN.test(normalized) ||
      UNSUPPORTED_SUPPORT_ACTION_PATTERNS.some((pattern) =>
        pattern.test(normalized),
      )
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
