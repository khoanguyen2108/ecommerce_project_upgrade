import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_SUPPORT_SNIPPETS = 6;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export type SupportContentStatus = 'approved' | 'handoff_only';
export type SupportContentCategory =
  | 'general'
  | 'returns'
  | 'shipping'
  | 'sizing';

export interface ApprovedSupportContent {
  id: string;
  title: string;
  category: SupportContentCategory;
  locale: 'en';
  status: SupportContentStatus;
  content: string;
  effectiveDate: string;
  lastReviewedAt: string;
}

@Injectable()
export class SupportKnowledgeService {
  private readonly content: ApprovedSupportContent[];

  constructor() {
    this.content = this.loadApprovedContent();
  }

  selectRelevant(message: string): ApprovedSupportContent[] {
    const normalizedMessage = message.toLocaleLowerCase();
    const categories = this.detectCategories(normalizedMessage);
    const selectedCategories =
      categories.length > 0 ? new Set(categories) : new Set(['general']);

    const relevant = this.content.filter((item) =>
      selectedCategories.has(item.category),
    );

    if (
      categories.length > 0 &&
      relevant.length < MAX_SUPPORT_SNIPPETS
    ) {
      relevant.push(
        ...this.content.filter((item) => item.category === 'general'),
      );
    }

    return relevant.slice(0, MAX_SUPPORT_SNIPPETS);
  }

  private detectCategories(message: string): SupportContentCategory[] {
    const categories: SupportContentCategory[] = [];

    if (/\b(return|returns|refund|refunds|exchange|exchanges)\b/i.test(message)) {
      categories.push('returns');
    }

    if (
      /\b(ship|ships|shipped|shipping|delivery|deliver|delivered|tracking)\b/i.test(
        message,
      )
    ) {
      categories.push('shipping');
    }

    if (
      /\b(size|sizes|sizing|measurement|measurements|fit|fits)\b/i.test(message)
    ) {
      categories.push('sizing');
    }

    return categories;
  }

  private loadApprovedContent(): ApprovedSupportContent[] {
    try {
      const rawContent = readFileSync(
        join(__dirname, 'knowledge', 'approved-support-content.json'),
        'utf8',
      );
      const parsed: unknown = JSON.parse(rawContent);

      if (!Array.isArray(parsed)) {
        return [];
      }

      const content: ApprovedSupportContent[] = [];
      const seenIds = new Set<string>();

      for (const item of parsed) {
        const validated = this.validateContentItem(item);

        if (!validated || seenIds.has(validated.id)) {
          return [];
        }

        seenIds.add(validated.id);
        content.push(validated);
      }

      return content;
    } catch {
      return [];
    }
  }

  private validateContentItem(
    value: unknown,
  ): ApprovedSupportContent | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const allowedKeys = new Set([
      'id',
      'title',
      'category',
      'locale',
      'status',
      'content',
      'effectiveDate',
      'lastReviewedAt',
    ]);

    if (
      !Object.keys(value).every((key) => allowedKeys.has(key)) ||
      typeof value.id !== 'string' ||
      !SAFE_ID_PATTERN.test(value.id) ||
      typeof value.title !== 'string' ||
      !this.isSafeText(value.title, 160) ||
      !this.isSupportCategory(value.category) ||
      value.locale !== 'en' ||
      !this.isSupportStatus(value.status) ||
      typeof value.content !== 'string' ||
      !this.isSafeText(value.content, 1_200) ||
      typeof value.effectiveDate !== 'string' ||
      !ISO_DATE_PATTERN.test(value.effectiveDate) ||
      typeof value.lastReviewedAt !== 'string' ||
      !ISO_DATE_PATTERN.test(value.lastReviewedAt)
    ) {
      return undefined;
    }

    return {
      id: value.id,
      title: value.title.trim(),
      category: value.category,
      locale: value.locale,
      status: value.status,
      content: value.content.trim(),
      effectiveDate: value.effectiveDate,
      lastReviewedAt: value.lastReviewedAt,
    };
  }

  private isSafeText(value: string, maxLength: number): boolean {
    const normalized = value.trim();

    return (
      normalized.length > 0 &&
      normalized.length <= maxLength &&
      !DISALLOWED_CONTROL_CHARACTERS.test(normalized)
    );
  }

  private isSupportCategory(
    value: unknown,
  ): value is SupportContentCategory {
    return (
      value === 'general' ||
      value === 'returns' ||
      value === 'shipping' ||
      value === 'sizing'
    );
  }

  private isSupportStatus(value: unknown): value is SupportContentStatus {
    return value === 'approved' || value === 'handoff_only';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

