import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiConfigService } from './ai-config.service';
import {
  AiOutputValidationError,
  AiOutputValidator,
} from './ai-output-validator';
import type {
  SupportOrderSummaryDto,
  SupportRequestDto,
  SupportResponseDto,
  SupportSourceDto,
} from './dto/support.dto';
import { AiProviderError, OpenRouterService } from './openrouter.service';
import { AiQuotaService } from './ai-quota.service';
import { AiScopeService, type AiScopeLocale } from './ai-scope.service';
import type { SupportOrderPromptContext } from './prompts/support.prompt';
import {
  SupportKnowledgeService,
  type ApprovedSupportContent,
} from './support-knowledge.service';

const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const ORDER_RELATED_PATTERN =
  /\b(order|ordered|payment|paid|tracking|track|package|parcel|purchase|status)\b/i;
const RISKY_SUPPORT_PATTERN =
  /\b(refund|chargeback|dispute|charged(?:-| )but(?:-| )not(?:-| )paid|debited(?:-| )but(?:-| )not(?:-| )paid|charged but|debited but|failed webhook|reconciliation|cancel|cancellation|change (?:my |the )?address|address change|return eligibility|return eligible|eligible (?:for )?(?:a )?return|qualif(?:y|ies|ied) (?:for )?(?:a )?return|can i return|may i return|exception|exact measurements?|measurement chart|fit confirmation|guarantee(?:d)? fit|legal|lawyer|privacy|personal data|delete my data|threat|abuse)\b/i;
const POSSIBLE_PII_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d .()-]{7,}\d)|\b(?:my name is|shipping address is|home address is)\b/i;
const KNOWN_ORDER_STATUS_VALUES = [
  'PENDING_PAYMENT',
  'PAID',
  'CANCELLED',
  'EXPIRED',
  'PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
] as const;

const supportOrderSelect = {
  id: true,
  status: true,
  fulfillmentStatus: true,
  updatedAt: true,
  payments: {
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 1,
    select: {
      status: true,
    },
  },
} as const satisfies Prisma.OrderSelect;

type SupportOrderRecord = Prisma.OrderGetPayload<{
  select: typeof supportOrderSelect;
}>;

export interface SupportRequestContext {
  requestId?: string;
  userId: string;
}

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiConfigService: AiConfigService,
    private readonly supportKnowledgeService: SupportKnowledgeService,
    private readonly aiOutputValidator: AiOutputValidator,
    private readonly openRouterService: OpenRouterService,
    private readonly aiScopeService: AiScopeService,
    private readonly aiQuotaService: AiQuotaService,
  ) {}

  async getSupport(
    dto: SupportRequestDto,
    context: SupportRequestContext,
  ): Promise<SupportResponseDto> {
    const startedAt = Date.now();

    this.logEvent('AI_SUPPORT_REQUESTED', context, {
      sourceCount: 0,
      hasOrderContext: false,
      latencyMs: 0,
    });

    try {
      const message = this.normalizeMessage(dto.message);
      const scopeDecision = this.aiScopeService.evaluateSupport(message);

      this.aiScopeService.logDecision('/ai/support', scopeDecision, context);

      if (scopeDecision.result !== 'allowed') {
        return this.buildOutOfScopeResponse(scopeDecision.locale);
      }

      const quotaLease = await this.aiQuotaService.acquire(
        'support',
        context.userId,
      );

      try {
      const config = this.aiConfigService.getRuntimeConfig();

      if (!config.enabled) {
        return this.buildHandoff(
          context,
          startedAt,
          [],
          undefined,
          'AI_DISABLED',
          'Belikeme AI Support is currently unavailable. Please contact Belikeme Support.',
        );
      }

      if (!this.aiConfigService.isConfigured()) {
        throw new ServiceUnavailableException({
          code: 'AI_NOT_CONFIGURED',
          message: 'Belikeme AI Support is not configured.',
        });
      }

      const supportContent =
        this.supportKnowledgeService.selectRelevant(message);

      if (!dto.orderId && this.isOrderRelated(message)) {
        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          undefined,
          'ORDER_CONTEXT_REQUIRED',
          'Please select or provide the order you want Belikeme Support to review.',
          'I need help with an order and can provide the order ID.',
        );
      }

      const order = dto.orderId
        ? await this.loadOwnedOrder(dto.orderId, context.userId)
        : undefined;
      const orderSummary = order ? this.toOrderSummary(order) : undefined;
      const orderPromptContext = order
        ? this.toOrderPromptContext(order)
        : undefined;

      if (supportContent.length === 0) {
        return this.buildHandoff(
          context,
          startedAt,
          [],
          orderSummary,
          'SUPPORT_CONTENT_UNAVAILABLE',
          'Approved support information is unavailable. Please contact Belikeme Support.',
        );
      }

      if (POSSIBLE_PII_PATTERN.test(message)) {
        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          orderSummary,
          'SENSITIVE_REQUEST',
          'This request may contain personal information and needs human support.',
        );
      }

      if (RISKY_SUPPORT_PATTERN.test(message)) {
        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          orderSummary,
          'STAFF_CONFIRMATION_REQUIRED',
          'This request requires confirmation from Belikeme Support staff.',
        );
      }

      if (supportContent.some((item) => item.status === 'handoff_only')) {
        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          orderSummary,
          'POLICY_REQUIRES_HANDOFF',
          'The approved support information requires staff confirmation for this request.',
        );
      }

      let providerContent: string;

      try {
        providerContent = await this.openRouterService.requestSupportAnswer(
          message,
          supportContent,
          orderPromptContext,
        );
      } catch (error) {
        const errorCode =
          error instanceof AiProviderError ? error.code : 'AI_UNAVAILABLE';

        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          orderSummary,
          errorCode,
          'Belikeme AI Support is temporarily unavailable. Please contact Belikeme Support.',
        );
      }

      try {
        const output = this.aiOutputValidator.validateSupport(
          providerContent,
          new Set(supportContent.map((item) => item.id)),
        );
        const citedContent = this.resolveCitedContent(
          output.sourceIds,
          supportContent,
        );

        if (
          orderPromptContext &&
          this.isOrderRelated(message) &&
          !output.handoff.required &&
          !this.isOrderAnswerGrounded(output.answer, orderPromptContext)
        ) {
          throw new AiOutputValidationError();
        }

        if (
          !orderPromptContext &&
          !output.handoff.required &&
          citedContent.every(
            (item) => item.id === 'support-human-handoff',
          )
        ) {
          return this.buildHandoff(
            context,
            startedAt,
            citedContent,
            undefined,
            'SUPPORT_CONTENT_INSUFFICIENT',
            'Approved support information does not contain an answer for this request. Please contact Belikeme Support.',
          );
        }

        if (citedContent.some((item) => item.status === 'handoff_only')) {
          return this.buildHandoff(
            context,
            startedAt,
            citedContent,
            orderSummary,
            'POLICY_REQUIRES_HANDOFF',
            'The approved support information requires staff confirmation for this request.',
          );
        }

        const answer = this.labelAnswer(output.answer);

        if (answer.length > 900) {
          throw new AiOutputValidationError();
        }

        const response: SupportResponseDto = {
          mode: output.handoff.required ? 'handoff' : 'ai',
          answer,
          sources: this.toSources(citedContent),
          ...(orderSummary ? { orderSummary } : {}),
          handoff: output.handoff,
        };

        this.logEvent(
          output.handoff.required
            ? 'AI_SUPPORT_HANDOFF'
            : 'AI_SUPPORT_SUCCEEDED',
          context,
          {
            mode: response.mode,
            sourceCount: response.sources.length,
            hasOrderContext: Boolean(orderSummary),
            latencyMs: Date.now() - startedAt,
          },
        );

        return response;
      } catch (error) {
        if (!(error instanceof AiOutputValidationError)) {
          throw error;
        }

        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          orderSummary,
          'AI_INVALID_RESPONSE',
          'Belikeme AI Support could not produce a safe answer. Please contact Belikeme Support.',
        );
      }
      } finally {
        await this.aiQuotaService.release(quotaLease);
      }
    } catch (error) {
      this.logEvent('AI_SUPPORT_FAILED', context, {
        sourceCount: 0,
        hasOrderContext: Boolean(dto.orderId),
        latencyMs: Date.now() - startedAt,
        errorCode: this.getSafeErrorCode(error),
      });

      throw error;
    }
  }

  private async loadOwnedOrder(
    orderId: string,
    userId: string,
  ): Promise<SupportOrderRecord> {
    const order = await this.prismaService.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: supportOrderSelect,
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order was not found.',
      });
    }

    return order;
  }

  private toOrderPromptContext(
    order: SupportOrderRecord,
  ): SupportOrderPromptContext {
    return {
      ref: 'O1',
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.payments[0]?.status ?? 'NOT_AVAILABLE',
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private toOrderSummary(order: SupportOrderRecord): SupportOrderSummaryDto {
    return {
      orderId: order.id,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.payments[0]?.status ?? 'NOT_AVAILABLE',
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private buildHandoff(
    context: SupportRequestContext,
    startedAt: number,
    content: ApprovedSupportContent[],
    orderSummary: SupportOrderSummaryDto | undefined,
    reason: string,
    answer: string,
    suggestedMessage = 'I need help from Belikeme Support with this request.',
  ): SupportResponseDto {
    const response: SupportResponseDto = {
      mode: 'handoff',
      answer: this.labelAnswer(answer),
      sources: this.toSources(content),
      ...(orderSummary ? { orderSummary } : {}),
      handoff: {
        required: true,
        reason,
        suggestedMessage,
      },
    };

    this.logEvent('AI_SUPPORT_HANDOFF', context, {
      mode: response.mode,
      sourceCount: response.sources.length,
      hasOrderContext: Boolean(orderSummary),
      latencyMs: Date.now() - startedAt,
      errorCode: reason,
    });

    return response;
  }

  private buildOutOfScopeResponse(locale: AiScopeLocale): SupportResponseDto {
    return {
      mode: 'handoff',
      answer: this.labelAnswer(
        locale === 'vi'
          ? 'Mình có thể hỗ trợ bạn về sản phẩm Belikeme, size, đơn hàng, giao hàng hoặc đổi trả. Bạn thử hỏi về trải nghiệm mua sắm hoặc đơn hàng của mình nhé.'
          : 'I can help with Belikeme products, sizing, shipping, returns, and your order status. For unrelated topics, please ask me something about your shopping or order experience.',
      ),
      sources: [],
      handoff: {
        required: false,
        reason: 'OUT_OF_SCOPE',
        suggestedMessage:
          locale === 'vi'
            ? 'Mình cần hỗ trợ về sản phẩm hoặc đơn hàng Belikeme.'
            : 'I need help with my Belikeme order or product question.',
      },
    };
  }

  private resolveCitedContent(
    sourceIds: string[],
    content: ApprovedSupportContent[],
  ): ApprovedSupportContent[] {
    const contentById = new Map(content.map((item) => [item.id, item]));

    return sourceIds
      .map((sourceId) => contentById.get(sourceId))
      .filter((item): item is ApprovedSupportContent => Boolean(item));
  }

  private toSources(content: ApprovedSupportContent[]): SupportSourceDto[] {
    return content.map((item) => ({ id: item.id, title: item.title }));
  }

  private normalizeMessage(message: string): string {
    const normalized = message.trim().replace(/[ \t\r\n]+/g, ' ');

    if (
      normalized.length < 2 ||
      normalized.length > 800 ||
      DISALLOWED_CONTROL_CHARACTERS.test(normalized)
    ) {
      throw new BadRequestException({
        code: 'AI_INVALID_REQUEST',
        message: 'Support request is invalid.',
      });
    }

    return normalized;
  }

  private isOrderRelated(message: string): boolean {
    return ORDER_RELATED_PATTERN.test(message);
  }

  private isOrderAnswerGrounded(
    answer: string,
    order: SupportOrderPromptContext,
  ): boolean {
    let normalizedAnswer = answer
      .toLocaleUpperCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
    const allowedStatuses = new Set<string>([
      order.status,
      order.fulfillmentStatus,
      order.paymentStatus,
    ]);
    let includesAllowedStatus = false;

    for (const status of KNOWN_ORDER_STATUS_VALUES) {
      const statusPhrase = status.replace(/_/g, ' ');
      const pattern = new RegExp(`\\b${statusPhrase}\\b`, 'g');

      if (!pattern.test(normalizedAnswer)) {
        continue;
      }

      if (!allowedStatuses.has(status)) {
        return false;
      }

      includesAllowedStatus = true;
      normalizedAnswer = normalizedAnswer.replace(pattern, ' ');
    }

    return includesAllowedStatus;
  }

  private labelAnswer(answer: string): string {
    return answer.startsWith('Belikeme AI Support')
      ? answer
      : `Belikeme AI Support: ${answer}`;
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
    context: SupportRequestContext,
    fields: {
      mode?: SupportResponseDto['mode'];
      sourceCount: number;
      hasOrderContext: boolean;
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
