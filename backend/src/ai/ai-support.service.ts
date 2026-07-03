import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  ActiveOrderCardStatus,
  CustomerOrderSupportSummary,
} from '../orders/orders.service';
import { ChatService } from '../chat/chat.service';
import { ReturnsService } from '../returns/returns.service';
import { AiConversationMemoryService } from './ai-conversation-memory.service';
import { AiConfigService } from './ai-config.service';
import { AiOrderToolService } from './ai-order-tool.service';
import { AiProductComparisonService } from './ai-product-comparison.service';
import { AiSizeRecommendationService } from './ai-size-recommendation.service';
import {
  AiOutputValidationError,
  AiOutputValidator,
} from './ai-output-validator';
import type {
  ConversationMemoryDto,
  ProductComparisonDto,
  SizeRecommendationDto,
  SupportOrderSummaryDto,
  SupportRequestDto,
  SupportResponseDto,
  SupportSourceDto,
} from './dto/support.dto';
import type { AiPublicProduct } from './ai-product-context.service';
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
const RETURN_REQUEST_PATTERN =
  /\b(?:i\s+(?:want|need|would like)\s+(?:to\s+)?return|return\s+my\s+(?:order|item)|request\s+(?:a\s+)?return|start\s+(?:a\s+)?return|wrong\s+(?:size|item)|incorrect\s+item|damaged(?:\s+(?:item|order|product))?|(?:arrived\s+)?(?:broken|defective)|doesn['’]?t\s+fit|too\s+(?:small|large)|changed?\s+my\s+mind|change\s+of\s+mind)\b/i;
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
  'RETURNED',
  'FAILED',
] as const;

export interface SupportRequestContext {
  requestId?: string;
  userId: string;
}

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);

  constructor(
    private readonly aiOrderToolService: AiOrderToolService,
    private readonly aiConfigService: AiConfigService,
    private readonly supportKnowledgeService: SupportKnowledgeService,
    private readonly aiOutputValidator: AiOutputValidator,
    private readonly openRouterService: OpenRouterService,
    private readonly aiScopeService: AiScopeService,
    private readonly aiQuotaService: AiQuotaService,
    private readonly returnsService: ReturnsService,
    private readonly chatService: ChatService,
    private readonly conversationMemoryService: AiConversationMemoryService,
    private readonly productComparisonService: AiProductComparisonService,
    private readonly sizeRecommendationService: AiSizeRecommendationService,
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

      if (dto.action === 'TRACK_ORDER') {
        return this.getActiveOrderCards(context, startedAt);
      }

      if (dto.action === 'RETURN_REQUEST') {
        return this.getReturnRequestCard(context, startedAt, dto.orderId);
      }

      const scopeDecision = this.aiScopeService.evaluateSupport(message);

      this.aiScopeService.logDecision('/ai/support', scopeDecision, context);

      if (scopeDecision.result !== 'allowed') {
        return this.buildOutOfScopeResponse(scopeDecision.locale);
      }

      if (this.isReturnRequest(message)) {
        return this.getReturnRequestCard(context, startedAt, dto.orderId);
      }

      const conversationMessages =
        await this.chatService.getAiConversationMessages(context.userId);
      const memoryState = this.conversationMemoryService.build(
        conversationMessages,
        message,
      );

      if (memoryState.reset) {
        return this.buildConversationMemoryResponse(
          context,
          startedAt,
          memoryState.memory,
          true,
        );
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

      if (POSSIBLE_PII_PATTERN.test(message)) {
        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          undefined,
          'SENSITIVE_REQUEST',
          'This request may contain personal information and needs human support.',
        );
      }

      if (RISKY_SUPPORT_PATTERN.test(message)) {
        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          undefined,
          'STAFF_CONFIRMATION_REQUIRED',
          'This request requires confirmation from Belikeme Support staff.',
        );
      }

      let intentContent: string;

      try {
        intentContent = await this.openRouterService.requestSupportIntent(
          message,
          {
            ...memoryState.memory,
            ...(memoryState.pendingIntent
              ? { pendingIntent: memoryState.pendingIntent }
              : {}),
          },
        );
      } catch (error) {
        const errorCode =
          error instanceof AiProviderError ? error.code : 'AI_UNAVAILABLE';

        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          undefined,
          errorCode,
          'Belikeme AI Support is temporarily unavailable. Please contact Belikeme Support.',
        );
      }

      let intent: ReturnType<AiOutputValidator['validateSupportIntent']>;

      try {
        intent = this.aiOutputValidator.validateSupportIntent(intentContent);
      } catch (error) {
        if (!(error instanceof AiOutputValidationError)) {
          throw error;
        }

        return this.buildHandoff(
          context,
          startedAt,
          supportContent,
          undefined,
          'AI_INVALID_RESPONSE',
          'Belikeme AI Support could not understand this request safely. Please contact Belikeme Support.',
        );
      }

      if (
        memoryState.pendingIntent &&
        (intent.intent === 'GENERAL_SUPPORT' ||
          intent.intent === 'CONVERSATION_MEMORY')
      ) {
        intent = {
          intent: memoryState.pendingIntent,
          productQueries:
            memoryState.pendingIntent === 'PRODUCT_COMPARISON' &&
            intent.productQueries.length === 0
              ? [message]
              : intent.productQueries,
        };
      }

      if (intent.intent === 'TRACK_ORDER') {
        return this.getActiveOrderCards(context, startedAt);
      }

      if (intent.intent === 'RETURN_REQUEST') {
        return this.getReturnRequestCard(context, startedAt, dto.orderId);
      }

      if (intent.intent === 'SIZE_RECOMMENDATION') {
        const result = await this.sizeRecommendationService.recommend({
          currentProductId: dto.productId,
          memory: memoryState.memory,
          productQueries: intent.productQueries,
          sizeProfile: memoryState.sizeProfile,
        });
        const memory = result.product
          ? this.conversationMemoryService.withSelectedProducts(
              memoryState.memory,
              [this.toProductReference(result.product)],
            )
          : memoryState.memory;

        return this.buildSizeRecommendationResponse(
          context,
          startedAt,
          result.recommendation,
          memory,
        );
      }

      if (intent.intent === 'PRODUCT_COMPARISON') {
        const productQueries =
          intent.productQueries.length > 0
            ? intent.productQueries
            : this.extractComparisonQueries(message);
        const result = await this.productComparisonService.compare({
          currentProductId: dto.productId,
          memory: memoryState.memory,
          productQueries,
        });
        const memory = this.conversationMemoryService.withSelectedProducts(
          memoryState.memory,
          result.products.map((product) => this.toProductReference(product)),
        );

        return this.buildProductComparisonResponse(
          context,
          startedAt,
          result.comparison,
          memory,
        );
      }

      if (intent.intent === 'CONVERSATION_MEMORY') {
        return this.buildConversationMemoryResponse(
          context,
          startedAt,
          memoryState.memory,
          false,
        );
      }

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
        ? await this.aiOrderToolService.getOwnedOrderSummary(
            context.userId,
            dto.orderId,
          )
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
          type: 'text',
          answer,
          sources: this.toSources(citedContent),
          ...(orderSummary ? { orderSummary } : {}),
          handoff: output.handoff,
          ...(this.conversationMemoryService.hasRememberedPreferences(
            memoryState.memory,
          )
            ? { conversationMemory: memoryState.memory }
            : {}),
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

  private toOrderPromptContext(
    order: CustomerOrderSupportSummary,
  ): SupportOrderPromptContext {
    return {
      ref: 'O1',
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt,
    };
  }

  private toOrderSummary(
    order: CustomerOrderSupportSummary,
  ): SupportOrderSummaryDto {
    return {
      orderId: order.orderId,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt,
    };
  }

  private buildSizeRecommendationResponse(
    context: SupportRequestContext,
    startedAt: number,
    sizeRecommendation: SizeRecommendationDto,
    memory: ConversationMemoryDto,
  ): SupportResponseDto {
    const answer =
      sizeRecommendation.status === 'complete'
        ? [
            `Recommended size: ${sizeRecommendation.recommendedSize}.`,
            `Confidence: ${sizeRecommendation.confidence}%.`,
            sizeRecommendation.reason,
            sizeRecommendation.alternativeSize
              ? `Alternative: ${sizeRecommendation.alternativeSize}.`
              : undefined,
          ]
            .filter(Boolean)
            .join(' ')
        : sizeRecommendation.question ??
          sizeRecommendation.reason ??
          'A size recommendation is not available right now.';
    const response: SupportResponseDto = {
      mode: 'ai',
      type: 'size_recommendation',
      answer: this.labelAnswer(answer),
      sources: [],
      sizeRecommendation,
      conversationMemory: memory,
      handoff: { required: false },
    };

    this.logEvent('AI_SIZE_RECOMMENDATION_RETURNED', context, {
      mode: response.mode,
      sourceCount: 0,
      hasOrderContext: false,
      latencyMs: Date.now() - startedAt,
      errorCode:
        sizeRecommendation.status === 'complete'
          ? undefined
          : sizeRecommendation.status.toLocaleUpperCase(),
    });

    return response;
  }

  private buildProductComparisonResponse(
    context: SupportRequestContext,
    startedAt: number,
    comparison: ProductComparisonDto,
    memory: ConversationMemoryDto,
  ): SupportResponseDto {
    const answer =
      comparison.status === 'complete' && comparison.productA && comparison.productB
        ? `${comparison.productA.name} vs ${comparison.productB.name}. ${comparison.recommendation}`
        : comparison.question ?? 'Please choose two Belikeme products to compare.';
    const response: SupportResponseDto = {
      mode: 'ai',
      type: 'comparison_card',
      answer: this.labelAnswer(answer),
      sources: [],
      comparison,
      conversationMemory: memory,
      handoff: { required: false },
    };

    this.logEvent('AI_PRODUCT_COMPARISON_RETURNED', context, {
      mode: response.mode,
      sourceCount: 0,
      hasOrderContext: false,
      latencyMs: Date.now() - startedAt,
      errorCode:
        comparison.status === 'complete' ? undefined : 'NEEDS_INFORMATION',
    });

    return response;
  }

  private buildConversationMemoryResponse(
    context: SupportRequestContext,
    startedAt: number,
    memory: ConversationMemoryDto,
    reset: boolean,
  ): SupportResponseDto {
    const remembered = this.describeMemory(memory);
    const answer = reset
      ? 'I cleared the shopping preferences for this conversation.'
      : remembered
        ? `I will remember ${remembered} for this conversation.`
        : 'I do not have any shopping preferences saved in this conversation yet.';
    const response: SupportResponseDto = {
      mode: 'ai',
      type: 'conversation_memory',
      answer: this.labelAnswer(answer),
      sources: [],
      conversationMemory: memory,
      handoff: { required: false },
    };

    this.logEvent('AI_CONVERSATION_MEMORY_RETURNED', context, {
      mode: response.mode,
      sourceCount: 0,
      hasOrderContext: false,
      latencyMs: Date.now() - startedAt,
      errorCode: reset ? 'MEMORY_RESET' : undefined,
    });

    return response;
  }

  private describeMemory(memory: ConversationMemoryDto): string {
    const details: string[] = [];

    if (memory.budget) {
      details.push(`a budget of ${memory.budget.amount} ${memory.budget.currency}`);
    }

    if (memory.preferredStyle) {
      details.push(`${memory.preferredStyle} style`);
    }

    if (memory.preferredFit) {
      details.push(`${memory.preferredFit} fit`);
    }

    if (memory.occasion) {
      details.push(`the ${memory.occasion} occasion`);
    }

    if (memory.genderPreference) {
      details.push(`${memory.genderPreference} products`);
    }

    if (memory.favoriteColor) {
      details.push(`${memory.favoriteColor} as your color preference`);
    }

    return details.join(', ');
  }

  private toProductReference(product: AiPublicProduct) {
    return { name: product.name, slug: product.slug };
  }

  private extractComparisonQueries(message: string): string[] {
    const match = message.match(
      /\bcompare\s+(.+?)\s+(?:vs\.?|versus|with|and)\s+(.+?)(?:[?.!]|$)/i,
    );

    if (!match) {
      return [];
    }

    return [match[1], match[2]]
      .map((value) => value.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  private async getActiveOrderCards(
    context: SupportRequestContext,
    startedAt: number,
  ): Promise<SupportResponseDto> {
    const orders = await this.aiOrderToolService.getActiveOrders(context.userId);
    const singleOrder = orders.length === 1 ? orders[0] : undefined;
    const response: SupportResponseDto = {
      mode: 'ai',
      type:
        orders.length === 0
          ? 'text'
          : singleOrder
            ? 'single_order_card'
            : 'order_cards',
      answer:
        orders.length === 0
          ? "I couldn't find any active orders.\n\nYou can visit Order History for completed orders."
          : singleOrder
            ? `Your latest order is currently ${this.getOrderStatusLabel(singleOrder.status)}.`
            : 'I found your active orders.',
      sources: [],
      ...(singleOrder ? { order: singleOrder } : {}),
      ...(orders.length > 1 ? { orders } : {}),
      handoff: {
        required: false,
      },
    };

    this.logEvent('AI_SUPPORT_ACTIVE_ORDERS_RETURNED', context, {
      mode: response.mode,
      sourceCount: 0,
      hasOrderContext: orders.length > 0,
      latencyMs: Date.now() - startedAt,
    });

    return response;
  }

  private getOrderStatusLabel(status: ActiveOrderCardStatus): string {
    switch (status) {
      case 'PENDING_PAYMENT':
        return 'Pending payment';
      case 'PAID':
        return 'Paid';
      case 'PICKED_UP':
        return 'Picked up';
      case 'IN_TRANSIT':
        return 'Shipping';
      case 'OUT_FOR_DELIVERY':
        return 'Out for delivery';
    }
  }

  private async getReturnRequestCard(
    context: SupportRequestContext,
    startedAt: number,
    orderId?: string,
  ): Promise<SupportResponseDto> {
    const eligibility =
      await this.returnsService.getReturnEligibilityForCustomer(
        context.userId,
        orderId,
      );

    if (!eligibility.eligible) {
      const answer =
        eligibility.reason === 'PENDING_REQUEST_EXISTS'
          ? 'Your return request is already pending review.'
          : eligibility.reason === 'ORDER_NOT_DELIVERED'
            ? 'This order is not eligible yet. Return requests can be submitted after delivery.'
            : "I couldn't find a delivered order that is eligible for a return request.";
      const response: SupportResponseDto = {
        mode: 'ai',
        type: 'text',
        answer,
        sources: [],
        handoff: { required: false },
      };

      this.logEvent('AI_SUPPORT_RETURN_NOT_ELIGIBLE', context, {
        mode: response.mode,
        sourceCount: 0,
        hasOrderContext: Boolean(orderId),
        latencyMs: Date.now() - startedAt,
        errorCode: eligibility.reason,
      });

      return response;
    }

    const response: SupportResponseDto = {
      mode: 'ai',
      type: 'return_request_card',
      answer:
        eligibility.orders.length === 1
          ? 'This delivered order is eligible for a return request.'
          : `I found ${eligibility.orders.length} delivered orders eligible for a return request.`,
      sources: [],
      returnRequests: eligibility.orders,
      handoff: { required: false },
    };

    this.logEvent('AI_SUPPORT_RETURN_ELIGIBLE', context, {
      mode: response.mode,
      sourceCount: 0,
      hasOrderContext: true,
      latencyMs: Date.now() - startedAt,
    });

    return response;
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
      type: 'text',
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
      type: 'text',
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

  private isReturnRequest(message: string): boolean {
    return RETURN_REQUEST_PATTERN.test(message);
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
