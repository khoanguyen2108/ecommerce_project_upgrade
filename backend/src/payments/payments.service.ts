import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APIError,
  PayOS,
  type CreatePaymentLinkResponse,
  type Webhook,
  type WebhookData,
} from '@payos/node';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { OrderEmailService } from '../email/order-email.service';
import { Prisma } from '../generated/prisma/client';
import {
  OrderStatus,
  PaymentProvider,
  PaymentReconciliationIssueType,
  PaymentStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePayosPaymentDto } from './dto/create-payos-payment.dto';
import type { PayosStatusQueryDto } from './dto/payos-status-query.dto';

const PAYMENT_PROVIDER = PaymentProvider.PAYOS;
const DEFAULT_CURRENCY = 'VND';
const PAYOS_DESCRIPTION_PREFIX = 'Belikeme';
const PAYOS_WEBHOOK_ENDPOINT_PATH = '/payments/payos/webhook';
const WEBHOOK_STATUS_PROCESSED = 'PROCESSED';
const WEBHOOK_STATUS_IGNORED = 'IGNORED';
const WEBHOOK_STATUS_RECONCILIATION_REQUIRED = 'RECONCILIATION_REQUIRED';
const MAX_POSTGRES_INT = 2_147_483_647;

const paymentSelect = {
  id: true,
  orderId: true,
  provider: true,
  status: true,
  amount: true,
  currency: true,
  providerOrderCode: true,
  checkoutUrl: true,
  providerPaymentLinkId: true,
  providerTransactionReference: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
} as const satisfies Prisma.PaymentSelect;

const paymentDisplaySelect = {
  ...paymentSelect,
  order: {
    select: {
      id: true,
      userId: true,
      status: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      paidAt: true,
      cancelledAt: true,
      expiresAt: true,
    },
  },
} as const satisfies Prisma.PaymentSelect;

const paymentWebhookSelect = {
  ...paymentSelect,
  order: {
    select: {
      id: true,
      userId: true,
      status: true,
      totalAmount: true,
      currency: true,
      items: {
        select: {
          id: true,
          variantId: true,
          quantity: true,
        },
      },
    },
  },
} as const satisfies Prisma.PaymentSelect;

const orderForPaymentSelect = {
  id: true,
  userId: true,
  status: true,
  totalAmount: true,
  currency: true,
  expiresAt: true,
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      productName: true,
      quantity: true,
      unitPrice: true,
    },
  },
} as const satisfies Prisma.OrderSelect;

type PaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof paymentSelect;
}>;

type PaymentDisplayRecord = Prisma.PaymentGetPayload<{
  select: typeof paymentDisplaySelect;
}>;

type PaymentWebhookRecord = Prisma.PaymentGetPayload<{
  select: typeof paymentWebhookSelect;
}>;

type OrderForPayment = Prisma.OrderGetPayload<{
  select: typeof orderForPaymentSelect;
}>;

interface PayosCredentials {
  apiKey: string;
  checksumKey: string;
  clientId: string;
}

interface PayosCheckoutConfig extends PayosCredentials {
  cancelUrl: string;
  returnUrl: string;
  webhookUrl: string;
}

type PayosWebhookClassification = Exclude<
  PaymentStatus,
  typeof PaymentStatus.PENDING
>;

export interface PayosWebhookResult {
  duplicate: boolean;
  payment?: PaymentRecord;
  processed?: boolean;
  reconciliationRequired?: boolean;
  reason?: string;
  received: boolean;
  status?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly orderEmailService: OrderEmailService,
    private readonly prismaService: PrismaService,
  ) {}

  async createPayosPayment(
    user: AuthenticatedUser,
    dto: CreatePayosPaymentDto,
  ) {
    const order = await this.getOrderForPayment(user, dto.orderId);

    this.assertOrderPayable(order, new Date());
    this.assertGuestPaymentUnavailable(order);
    await this.assertNoReconciliationIssue(order.id);
    const payment = await this.getOrCreatePendingPayosPayment(order);
    await this.assertNoReconciliationIssue(order.id, payment.id);
    const config = this.getPayosCheckoutConfig();

    if (payment.checkoutUrl) {
      return this.toCreatePaymentResponse(payment, order.expiresAt);
    }

    const paymentLink = await this.createPayosPaymentLink(
      config,
      order,
      payment,
    );
    await this.assertNoReconciliationIssue(order.id, payment.id);
    this.assertPayosPaymentLink(payment, paymentLink);
    const updateResult = await this.prismaService.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
        reconciliationIssues: {
          none: {},
        },
        order: {
          status: OrderStatus.PENDING_PAYMENT,
          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: new Date(),
              },
            },
          ],
        },
      },
      data: {
        checkoutUrl: paymentLink.checkoutUrl,
        providerPaymentLinkId: paymentLink.paymentLinkId,
      },
    });

    if (updateResult.count !== 1) {
      await this.assertPaymentCanStillReceiveCheckoutLink(payment.id);
    }

    const updatedPayment = await this.prismaService.payment.findUnique({
      where: {
        id: payment.id,
      },
      select: paymentSelect,
    });

    if (!updatedPayment) {
      throw this.paymentNotFoundException();
    }

    return this.toCreatePaymentResponse(
      updatedPayment,
      order.expiresAt,
      paymentLink.qrCode,
    );
  }

  async handlePayosWebhook(
    body: unknown,
    requestId?: string,
  ): Promise<PayosWebhookResult> {
    const credentials = this.getPayosCredentials();
    const webhook = this.assertWebhookPayload(body);
    const verifiedData = await this.verifyPayosWebhook(credentials, webhook);
    this.assertVerifiedWebhookData(verifiedData);
    const signatureHash = this.hashValue(webhook.signature);
    const eventKey = this.buildWebhookEventKey(verifiedData, signatureHash);
    const metadata = this.sanitizeWebhookMetadata(webhook, verifiedData);
    const classification = this.classifyPayosWebhook(webhook, verifiedData);

    try {
      const result: PayosWebhookResult = await this.prismaService.$transaction(async (tx) => {
        const existingEvent = await tx.paymentWebhookEvent.findUnique({
          where: {
            provider_eventKey: {
              provider: PAYMENT_PROVIDER,
              eventKey,
            },
          },
          select: {
            id: true,
            processedAt: true,
            processingStatus: true,
          },
        });

        if (existingEvent) {
          return {
            received: true,
            duplicate: true,
            status: existingEvent.processingStatus,
          };
        }

        const event = await tx.paymentWebhookEvent.create({
          data: {
            provider: PAYMENT_PROVIDER,
            eventKey,
            signatureHash,
            metadata,
          },
          select: {
            id: true,
          },
        });
        const payment = await tx.payment.findUnique({
          where: {
            providerOrderCode: verifiedData.orderCode,
          },
          select: paymentWebhookSelect,
        });

        if (!payment || payment.provider !== PAYMENT_PROVIDER) {
          await this.markWebhookEventProcessed(tx, event.id, {
            processingStatus: WEBHOOK_STATUS_IGNORED,
          });

          return {
            received: true,
            duplicate: false,
            processed: false,
            reason: 'PAYMENT_NOT_FOUND',
          };
        }

        await tx.paymentWebhookEvent.update({
          where: {
            id: event.id,
          },
          data: {
            paymentId: payment.id,
            orderId: payment.orderId,
          },
        });

        if (classification === PaymentStatus.PAID) {
          const existingReconciliationIssue =
            await tx.paymentReconciliationIssue.findFirst({
              where: {
                paymentId: payment.id,
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: {
                type: true,
              },
            });

          if (existingReconciliationIssue) {
            await this.markWebhookEventProcessed(tx, event.id, {
              processingStatus: WEBHOOK_STATUS_RECONCILIATION_REQUIRED,
            });

            return {
              received: true,
              duplicate: false,
              processed: true,
              reconciliationRequired: true,
              payment: this.toSafePayment(payment),
              reason: existingReconciliationIssue.type,
            };
          }

          const validationFailureReason = this.getPaidWebhookValidationFailure(
            payment,
            verifiedData,
          );

          if (validationFailureReason) {
            return this.createProviderPaidReconciliationIssue(
              tx,
              event.id,
              payment,
              verifiedData,
              PaymentReconciliationIssueType.PROVIDER_LOCAL_STATUS_MISMATCH,
              validationFailureReason,
            );
          }

          if (
            await this.isProviderLinkOwnedByAnotherPayment(
              tx,
              payment,
              verifiedData.paymentLinkId,
            )
          ) {
            return this.createProviderPaidReconciliationIssue(
              tx,
              event.id,
              payment,
              verifiedData,
              PaymentReconciliationIssueType.PROVIDER_LOCAL_STATUS_MISMATCH,
              'PAYOS_PAYMENT_LINK_OWNED_BY_ANOTHER_PAYMENT',
            );
          }

          if (
            payment.status === PaymentStatus.PAID &&
            payment.order.status === OrderStatus.PAID
          ) {
            await this.markWebhookEventProcessed(tx, event.id, {
              processingStatus: WEBHOOK_STATUS_IGNORED,
            });

            return {
              received: true,
              duplicate: false,
              processed: false,
              payment: this.toSafePayment(payment),
              reason: 'PAYOS_PAID_ALREADY_FINALIZED',
            };
          }

          if (
            payment.status !== PaymentStatus.PENDING ||
            payment.order.status !== OrderStatus.PENDING_PAYMENT
          ) {
            return this.createProviderPaidReconciliationIssue(
              tx,
              event.id,
              payment,
              verifiedData,
              this.getLatePaidIssueType(payment),
              this.getLatePaidSafeReason(payment),
            );
          }

          return this.processPaidWebhook(
            tx,
            event.id,
            payment,
            verifiedData,
          );
        }

        if (
          payment.status === PaymentStatus.PAID ||
          payment.order.status === OrderStatus.PAID
        ) {
          await this.markWebhookEventProcessed(tx, event.id, {
            processingStatus: WEBHOOK_STATUS_IGNORED,
          });

          return {
            received: true,
            duplicate: false,
            processed: false,
            payment: this.toSafePayment(payment),
            reason: 'PAYOS_WEBHOOK_IGNORED_TERMINAL_STATE',
          };
        }

        if (
          payment.status !== PaymentStatus.PENDING ||
          payment.order.status !== OrderStatus.PENDING_PAYMENT
        ) {
          await this.markWebhookEventProcessed(tx, event.id, {
            processingStatus: WEBHOOK_STATUS_IGNORED,
          });

          return {
            received: true,
            duplicate: false,
            processed: false,
            payment: this.toSafePayment(payment),
            reason: 'PAYOS_WEBHOOK_IGNORED_TERMINAL_STATE',
          };
        }

        return this.processNonPaidWebhook(
          tx,
          event.id,
          payment,
          verifiedData,
          classification,
        );
      });

      this.queuePayosWebhookEmail(result);
      this.logger.log(
        JSON.stringify({
          requestId,
          provider: PAYMENT_PROVIDER,
          orderCode: verifiedData.orderCode,
          orderId: result.payment?.orderId,
          duplicate: result.duplicate,
          processed: result.processed ?? false,
          paymentStatus: result.payment?.status,
          reason: result.reason,
        }),
      );

      return result;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const uniqueTarget = this.getUniqueConstraintTarget(error);
        const existingEvent = await this.prismaService.paymentWebhookEvent.findUnique({
          where: {
            provider_eventKey: {
              provider: PAYMENT_PROVIDER,
              eventKey,
            },
          },
          select: {
            processingStatus: true,
          },
        });

        if (
          existingEvent &&
          (this.isWebhookEventUniqueConstraintTarget(uniqueTarget) ||
            !uniqueTarget)
        ) {
          this.logger.log(
            JSON.stringify({
              requestId,
              provider: PAYMENT_PROVIDER,
              orderCode: verifiedData.orderCode,
              duplicate: true,
              processed: false,
              reason: 'PAYOS_WEBHOOK_DUPLICATE_RACE',
              prismaTarget: uniqueTarget || 'CONFIRMED_BY_EVENT_KEY',
            }),
          );

          return {
            received: true,
            duplicate: true,
            status: existingEvent.processingStatus,
          };
        }

        const payment = await this.prismaService.payment.findUnique({
          where: {
            providerOrderCode: verifiedData.orderCode,
          },
          select: paymentWebhookSelect,
        });

        this.logger.warn(
          JSON.stringify({
            requestId,
            provider: PAYMENT_PROVIDER,
            orderCode: verifiedData.orderCode,
            paymentId: payment?.id,
            orderId: payment?.orderId,
            prismaTarget: uniqueTarget || 'UNKNOWN',
            reason: 'PAYOS_WEBHOOK_UNRELATED_UNIQUE_CONFLICT',
          }),
        );

        if (classification === PaymentStatus.PAID && payment) {
          return this.preservePaidUniqueConflictReconciliation(
            payment,
            verifiedData,
            uniqueTarget,
          );
        }

        throw new ServiceUnavailableException({
          code: 'PAYOS_WEBHOOK_PROCESSING_RETRY',
          message: 'payOS webhook processing should be retried.',
        });
      }

      throw error;
    }
  }

  async getPayosDisplayStatus(
    user: AuthenticatedUser,
    query: PayosStatusQueryDto,
    source: 'return' | 'cancel',
  ) {
    if (!query.orderId && !query.orderCode) {
      throw new BadRequestException({
        code: 'PAYOS_STATUS_QUERY_REQUIRED',
        message: 'Provide orderId or orderCode.',
      });
    }

    const payment = await this.prismaService.payment.findFirst({
      where: {
        provider: PAYMENT_PROVIDER,
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.orderCode ? { providerOrderCode: query.orderCode } : {}),
      },
      select: paymentDisplaySelect,
    });

    if (!payment || !this.canReadPayment(user, payment)) {
      throw this.paymentNotFoundException();
    }

    return {
      source,
      displayOnly: true,
      message:
        'Payment return and cancel pages are display-only. Final status is set only by verified payOS webhook.',
      statusMessage: this.getDisplayStatusMessage(payment, source),
      order: payment.order,
      payment: this.toSafePayment(payment),
    };
  }

  private async processPaidWebhook(
    tx: Prisma.TransactionClient,
    eventId: string,
    payment: PaymentWebhookRecord,
    verifiedData: WebhookData,
  ) {
    if (payment.order.items.length === 0) {
      return this.createProviderPaidReconciliationIssue(
        tx,
        eventId,
        payment,
        verifiedData,
        PaymentReconciliationIssueType.PROVIDER_LOCAL_STATUS_MISMATCH,
        'ORDER_ITEMS_MISSING',
      );
    }

    await this.lockPaidOrderStock(tx, payment);
    const latestPayment = await tx.payment.findUnique({
      where: {
        id: payment.id,
      },
      select: paymentWebhookSelect,
    });

    if (!latestPayment) {
      throw this.paymentNotFoundException();
    }

    const latestReconciliationIssue =
      await tx.paymentReconciliationIssue.findFirst({
        where: {
          paymentId: payment.id,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          type: true,
        },
      });

    if (latestReconciliationIssue) {
      await this.markWebhookEventProcessed(tx, eventId, {
        processingStatus: WEBHOOK_STATUS_RECONCILIATION_REQUIRED,
      });

      return {
        received: true,
        duplicate: false,
        processed: true,
        reconciliationRequired: true,
        payment: this.toSafePayment(latestPayment),
        reason: latestReconciliationIssue.type,
      };
    }

    if (
      await this.isProviderLinkOwnedByAnotherPayment(
        tx,
        latestPayment,
        verifiedData.paymentLinkId,
      )
    ) {
      return this.createProviderPaidReconciliationIssue(
        tx,
        eventId,
        latestPayment,
        verifiedData,
        PaymentReconciliationIssueType.PROVIDER_LOCAL_STATUS_MISMATCH,
        'PAYOS_PAYMENT_LINK_OWNED_BY_ANOTHER_PAYMENT',
      );
    }

    if (
      latestPayment.status === PaymentStatus.PAID &&
      latestPayment.order.status === OrderStatus.PAID
    ) {
      await this.markWebhookEventProcessed(tx, eventId, {
        processingStatus: WEBHOOK_STATUS_IGNORED,
      });

      return {
        received: true,
        duplicate: false,
        processed: false,
        payment: this.toSafePayment(latestPayment),
        reason: 'PAYOS_PAID_ALREADY_FINALIZED',
      };
    }

    if (
      latestPayment.status !== PaymentStatus.PENDING ||
      latestPayment.order.status !== OrderStatus.PENDING_PAYMENT
    ) {
      return this.createProviderPaidReconciliationIssue(
        tx,
        eventId,
        latestPayment,
        verifiedData,
        this.getLatePaidIssueType(latestPayment),
        this.getLatePaidSafeReason(latestPayment),
      );
    }

    payment = latestPayment;

    if (!(await this.hasEnoughStockForPaidOrder(tx, payment))) {
      return this.createProviderPaidReconciliationIssue(
        tx,
        eventId,
        payment,
        verifiedData,
        PaymentReconciliationIssueType.PAID_STOCK_SHORTAGE,
        'Provider confirmed payment, but local stock is insufficient.',
      );
    }

    const paidAt = new Date();
    const orderUpdate = await tx.order.updateMany({
      where: {
        id: payment.orderId,
        status: OrderStatus.PENDING_PAYMENT,
      },
      data: {
        status: OrderStatus.PAID,
        paidAt,
      },
    });

    if (orderUpdate.count !== 1) {
      return this.createProviderPaidReconciliationIssue(
        tx,
        eventId,
        payment,
        verifiedData,
        PaymentReconciliationIssueType.LATE_PROVIDER_PAID,
        'Provider confirmed payment while local order state changed concurrently.',
      );
    }

    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.PAID,
        providerPaymentLinkId:
          verifiedData.paymentLinkId || payment.providerPaymentLinkId,
        providerTransactionReference: this.truncateProviderReference(
          verifiedData.reference,
        ),
        failureReason: null,
        paidAt,
      },
    });

    if (paymentUpdate.count !== 1) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_FINALIZATION_RETRY',
        message: 'Payment finalization should be retried.',
      });
    }

    for (const [variantId, quantity] of this.getRequiredStockByVariant(payment)) {
      const stockUpdate = await tx.productVariant.updateMany({
        where: {
          id: variantId,
          stock: {
            gte: quantity,
          },
        },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      });

      if (stockUpdate.count !== 1) {
        throw new ServiceUnavailableException({
          code: 'PAYMENT_STOCK_FINALIZATION_RETRY',
          message: 'Payment finalization should be retried.',
        });
      }
    }

    const updatedPayment = await tx.payment.findUnique({
      where: {
        id: payment.id,
      },
      select: paymentSelect,
    });

    if (!updatedPayment) {
      throw this.paymentNotFoundException();
    }

    await this.markWebhookEventProcessed(tx, eventId, {
      processingStatus: WEBHOOK_STATUS_PROCESSED,
    });

    return {
      received: true,
      duplicate: false,
      processed: true,
      payment: updatedPayment,
    };
  }

  private async createProviderPaidReconciliationIssue(
    tx: Prisma.TransactionClient,
    eventId: string,
    payment: PaymentWebhookRecord,
    verifiedData: WebhookData,
    type: PaymentReconciliationIssueType,
    safeReason: string,
  ) {
    await tx.paymentReconciliationIssue.upsert({
      where: {
        paymentId_type: {
          paymentId: payment.id,
          type,
        },
      },
      create: {
        orderId: payment.orderId,
        paymentId: payment.id,
        type,
        provider: PAYMENT_PROVIDER,
        providerOrderCode: payment.providerOrderCode,
        providerPaymentLinkId:
          verifiedData.paymentLinkId || payment.providerPaymentLinkId,
        providerTransactionReference: this.truncateProviderReference(
          verifiedData.reference,
        ),
        amount: verifiedData.amount,
        currency: verifiedData.currency,
        safeReason: safeReason.slice(0, 160),
      },
      update: {},
    });

    await this.markWebhookEventProcessed(tx, eventId, {
      processingStatus: WEBHOOK_STATUS_RECONCILIATION_REQUIRED,
    });

    return {
      received: true,
      duplicate: false,
      processed: true,
      reconciliationRequired: true,
      payment: this.toSafePayment(payment),
      reason: type,
    };
  }

  private async preservePaidUniqueConflictReconciliation(
    payment: PaymentWebhookRecord,
    verifiedData: WebhookData,
    uniqueTarget: string,
  ): Promise<PayosWebhookResult> {
    const safeReason = uniqueTarget
      ? `PAYOS_UNIQUE_CONFLICT_${uniqueTarget}`
      : 'PAYOS_UNIQUE_CONFLICT_UNKNOWN';

    await this.prismaService.paymentReconciliationIssue.upsert({
      where: {
        paymentId_type: {
          paymentId: payment.id,
          type: PaymentReconciliationIssueType.PROVIDER_LOCAL_STATUS_MISMATCH,
        },
      },
      create: {
        orderId: payment.orderId,
        paymentId: payment.id,
        type: PaymentReconciliationIssueType.PROVIDER_LOCAL_STATUS_MISMATCH,
        provider: PAYMENT_PROVIDER,
        providerOrderCode: payment.providerOrderCode,
        providerPaymentLinkId:
          verifiedData.paymentLinkId || payment.providerPaymentLinkId,
        providerTransactionReference: this.truncateProviderReference(
          verifiedData.reference,
        ),
        amount: verifiedData.amount,
        currency: verifiedData.currency,
        safeReason: safeReason.slice(0, 160),
      },
      update: {},
    });

    return {
      received: true,
      duplicate: false,
      processed: true,
      reconciliationRequired: true,
      payment: this.toSafePayment(payment),
      reason: PaymentReconciliationIssueType.PROVIDER_LOCAL_STATUS_MISMATCH,
    };
  }

  private async isProviderLinkOwnedByAnotherPayment(
    tx: Prisma.TransactionClient,
    payment: PaymentWebhookRecord,
    providerPaymentLinkId: string | undefined,
  ): Promise<boolean> {
    if (!providerPaymentLinkId) {
      return false;
    }

    const linkOwner = await tx.payment.findUnique({
      where: {
        providerPaymentLinkId,
      },
      select: {
        id: true,
      },
    });

    return Boolean(linkOwner && linkOwner.id !== payment.id);
  }

  private getLatePaidIssueType(
    payment: PaymentWebhookRecord,
  ): PaymentReconciliationIssueType {
    if (
      payment.order.status === OrderStatus.EXPIRED ||
      payment.status === PaymentStatus.EXPIRED
    ) {
      return PaymentReconciliationIssueType.PAID_AFTER_LOCAL_EXPIRED;
    }

    if (
      payment.order.status === OrderStatus.CANCELLED ||
      payment.status === PaymentStatus.CANCELLED
    ) {
      return PaymentReconciliationIssueType.PAID_AFTER_LOCAL_CANCELLED;
    }

    return PaymentReconciliationIssueType.LATE_PROVIDER_PAID;
  }

  private getLatePaidSafeReason(payment: PaymentWebhookRecord): string {
    return `Provider confirmed payment after local order ${payment.order.status} / payment ${payment.status}.`;
  }

  private async processNonPaidWebhook(
    tx: Prisma.TransactionClient,
    eventId: string,
    payment: PaymentWebhookRecord,
    verifiedData: WebhookData,
    status: Exclude<PayosWebhookClassification, typeof PaymentStatus.PAID>,
  ) {
    const finalizedAt = new Date();
    const orderStatus =
      status === PaymentStatus.EXPIRED
        ? OrderStatus.EXPIRED
        : OrderStatus.CANCELLED;
    const orderUpdate = await tx.order.updateMany({
      where: {
        id: payment.orderId,
        status: OrderStatus.PENDING_PAYMENT,
      },
      data: {
        status: orderStatus,
        cancelledAt: finalizedAt,
      },
    });

    if (orderUpdate.count !== 1) {
      return this.ignoreWebhookForTerminalState(tx, eventId, payment);
    }

    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status,
        providerPaymentLinkId:
          verifiedData.paymentLinkId || payment.providerPaymentLinkId,
        providerTransactionReference: this.truncateProviderReference(
          verifiedData.reference,
        ),
        failureReason: `PAYOS_${status}`,
        cancelledAt: finalizedAt,
      },
    });

    if (paymentUpdate.count !== 1) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_FINALIZATION_RETRY',
        message: 'Payment finalization should be retried.',
      });
    }

    const updatedPayment = await tx.payment.findUnique({
      where: {
        id: payment.id,
      },
      select: paymentSelect,
    });

    if (!updatedPayment) {
      throw this.paymentNotFoundException();
    }

    await this.markWebhookEventProcessed(tx, eventId, {
      processingStatus: WEBHOOK_STATUS_PROCESSED,
    });

    return {
      received: true,
      duplicate: false,
      processed: true,
      payment: updatedPayment,
    };
  }

  private async hasEnoughStockForPaidOrder(
    tx: Prisma.TransactionClient,
    payment: PaymentWebhookRecord,
  ): Promise<boolean> {
    const stockRows = await tx.productVariant.findMany({
      where: {
        id: {
          in: payment.order.items.map((item) => item.variantId),
        },
      },
      select: {
        id: true,
        stock: true,
      },
    });
    const stockByVariantId = new Map(
      stockRows.map((stockRow) => [stockRow.id, stockRow.stock]),
    );

    return [...this.getRequiredStockByVariant(payment)].every(
      ([variantId, quantity]) => {
        const currentStock = stockByVariantId.get(variantId);

        return currentStock !== undefined && currentStock >= quantity;
      },
    );
  }

  private async lockPaidOrderStock(
    tx: Prisma.TransactionClient,
    payment: PaymentWebhookRecord,
  ): Promise<void> {
    const variantIds = [...this.getRequiredStockByVariant(payment).keys()];

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "ProductVariant" WHERE "id" IN (${Prisma.join(
        variantIds,
      )}) ORDER BY "id" FOR UPDATE`,
    );
  }

  private getRequiredStockByVariant(
    payment: PaymentWebhookRecord,
  ): Map<string, number> {
    const required = new Map<string, number>();

    for (const item of payment.order.items) {
      required.set(
        item.variantId,
        (required.get(item.variantId) ?? 0) + item.quantity,
      );
    }

    return required;
  }

  private async markWebhookEventProcessed(
    tx: Prisma.TransactionClient,
    eventId: string,
    data: {
      processingStatus: string;
    },
  ) {
    await tx.paymentWebhookEvent.update({
      where: {
        id: eventId,
      },
      data: {
        ...data,
        processedAt: new Date(),
      },
    });
  }

  private async ignoreWebhookForTerminalState(
    tx: Prisma.TransactionClient,
    eventId: string,
    payment: PaymentWebhookRecord,
  ) {
    await this.markWebhookEventProcessed(tx, eventId, {
      processingStatus: WEBHOOK_STATUS_IGNORED,
    });

    return {
      received: true,
      duplicate: false,
      processed: false,
      payment: this.toSafePayment(payment),
      reason: 'PAYOS_WEBHOOK_IGNORED_TERMINAL_STATE',
    };
  }

  private async getOrderForPayment(
    user: AuthenticatedUser,
    orderId: string,
  ): Promise<OrderForPayment> {
    const order = await this.prismaService.order.findFirst({
      where: {
        id: orderId,
        ...(user.role === UserRole.ADMIN ? {} : { userId: user.id }),
      },
      select: orderForPaymentSelect,
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order was not found.',
      });
    }

    return order;
  }

  private assertGuestPaymentUnavailable(order: OrderForPayment): void {
    if (order.userId !== null) {
      return;
    }

    throw new BadRequestException({
      code: 'GUEST_PAYMENT_NOT_AVAILABLE',
      message: 'Online payment is not available for guest orders.',
    });
  }

  private async assertNoReconciliationIssue(
    orderId: string,
    paymentId?: string,
  ): Promise<void> {
    const issue = await this.prismaService.paymentReconciliationIssue.findFirst({
      where: {
        orderId,
        ...(paymentId ? { paymentId } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!issue) {
      return;
    }

    throw new ConflictException({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
      message: 'Payment requires manual review. Please contact support.',
    });
  }

  private queuePayosWebhookEmail(result: PayosWebhookResult) {
    if (
      result.duplicate ||
      result.reconciliationRequired ||
      result.processed !== true ||
      !result.payment
    ) {
      return;
    }

    const { payment, reason } = result;

    if (payment.status === PaymentStatus.PAID) {
      void this.orderEmailService.sendPaymentSuccessEmail(
        payment.orderId,
        payment.id,
      );
      return;
    }

    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.EXPIRED ||
      payment.status === PaymentStatus.FAILED
    ) {
      void this.orderEmailService.sendPaymentFailedEmail(
        payment.orderId,
        payment.id,
        reason ?? payment.failureReason ?? undefined,
      );
    }
  }

  private assertOrderPayable(order: OrderForPayment, now: Date) {
    if (order.status === OrderStatus.EXPIRED) {
      throw new BadRequestException({
        code: 'PAYOS_ORDER_EXPIRED',
        message: 'Order has expired.',
      });
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException({
        code: 'ORDER_NOT_PENDING_PAYMENT',
        message: 'Order is not pending payment.',
      });
    }

    if (this.isOrderExpired(order, now)) {
      throw new BadRequestException({
        code: 'PAYOS_ORDER_EXPIRED',
        message: 'Order has expired.',
      });
    }

    if (!Number.isSafeInteger(order.totalAmount) || order.totalAmount <= 0) {
      throw new BadRequestException({
        code: 'ORDER_TOTAL_INVALID',
        message: 'Order total is invalid.',
      });
    }

    if (order.items.length === 0) {
      throw new BadRequestException({
        code: 'ORDER_ITEMS_MISSING',
        message: 'Order has no items.',
      });
    }

    if (order.currency !== DEFAULT_CURRENCY) {
      throw new BadRequestException({
        code: 'PAYMENT_CURRENCY_MISMATCH',
        message: 'Order currency is not supported by payOS.',
      });
    }
  }

  private isOrderExpired(
    order: Pick<OrderForPayment, 'expiresAt'>,
    now: Date,
  ): boolean {
    return Boolean(order.expiresAt && order.expiresAt.getTime() <= now.getTime());
  }

  private async assertPaymentCanStillReceiveCheckoutLink(paymentId: string) {
    const latestPayment = await this.prismaService.payment.findUnique({
      where: {
        id: paymentId,
      },
      select: paymentDisplaySelect,
    });

    if (!latestPayment) {
      throw this.paymentNotFoundException();
    }

    if (latestPayment.order.status === OrderStatus.EXPIRED) {
      throw new BadRequestException({
        code: 'PAYOS_ORDER_EXPIRED',
        message: 'Order has expired.',
      });
    }

    if (latestPayment.order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException({
        code: 'ORDER_NOT_PENDING_PAYMENT',
        message: 'Order is not pending payment.',
      });
    }

    if (this.isOrderExpired(latestPayment.order, new Date())) {
      throw new BadRequestException({
        code: 'PAYOS_ORDER_EXPIRED',
        message: 'Order has expired.',
      });
    }

    if (latestPayment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_PENDING',
        message: 'Payment is not pending.',
      });
    }

    await this.assertNoReconciliationIssue(
      latestPayment.order.id,
      latestPayment.id,
    );

    throw new ServiceUnavailableException({
      code: 'PAYOS_CHECKOUT_LINK_RACE',
      message: 'payOS checkout link creation should be retried.',
    });
  }

  private async getOrCreatePendingPayosPayment(
    order: OrderForPayment,
  ): Promise<PaymentRecord> {
    const payment = await this.prismaService.payment.upsert({
      where: {
        orderId_provider: {
          orderId: order.id,
          provider: PAYMENT_PROVIDER,
        },
      },
      update: {},
      create: {
        orderId: order.id,
        provider: PAYMENT_PROVIDER,
        status: PaymentStatus.PENDING,
        amount: order.totalAmount,
        currency: order.currency,
      },
      select: paymentSelect,
    });

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_PENDING',
        message: 'Payment is not pending.',
      });
    }

    if (payment.amount !== order.totalAmount) {
      throw new BadRequestException({
        code: 'PAYMENT_AMOUNT_MISMATCH',
        message: 'Payment amount does not match the order total.',
      });
    }

    if (payment.currency !== order.currency) {
      throw new BadRequestException({
        code: 'PAYMENT_CURRENCY_MISMATCH',
        message: 'Payment currency does not match the order currency.',
      });
    }

    return payment;
  }

  private async createPayosPaymentLink(
    config: PayosCheckoutConfig,
    order: OrderForPayment,
    payment: PaymentRecord,
  ): Promise<CreatePaymentLinkResponse> {
    const payos = this.createPayosClient(config);

    try {
      return await payos.paymentRequests.create({
        orderCode: payment.providerOrderCode,
        amount: payment.amount,
        description: `${PAYOS_DESCRIPTION_PREFIX} ${payment.providerOrderCode}`,
        ...this.getPayosItems(order, payment.amount),
        ...(order.expiresAt
          ? { expiredAt: Math.floor(order.expiresAt.getTime() / 1000) }
          : {}),
        returnUrl: this.buildRedirectUrl(
          config.returnUrl,
          order.id,
          payment.providerOrderCode,
        ),
        cancelUrl: this.buildRedirectUrl(
          config.cancelUrl,
          order.id,
          payment.providerOrderCode,
        ),
      });
    } catch (error) {
      throw this.payosProviderException(error);
    }
  }

  private getPayosItems(order: OrderForPayment, paymentAmount: number) {
    const itemTotal = order.items.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );

    if (itemTotal !== paymentAmount) {
      return {};
    }

    return {
      items: order.items.map((item) => ({
        name: this.truncatePayosItemName(item.productName),
        quantity: item.quantity,
        price: item.unitPrice,
      })),
    };
  }

  private assertPayosPaymentLink(
    payment: PaymentRecord,
    paymentLink: CreatePaymentLinkResponse,
  ) {
    if (
      paymentLink.orderCode !== payment.providerOrderCode ||
      paymentLink.amount !== payment.amount ||
      paymentLink.currency !== payment.currency ||
      !paymentLink.checkoutUrl ||
      !paymentLink.paymentLinkId
    ) {
      throw new ServiceUnavailableException({
        code: 'PAYOS_PROVIDER_RESPONSE_INVALID',
        message: 'payOS returned an invalid payment link response.',
      });
    }
  }

  private toCreatePaymentResponse(
    payment: PaymentRecord,
    expiresAt: Date | null,
    qrCode: string | null = null,
  ) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      checkoutUrl: payment.checkoutUrl,
      paymentUrl: payment.checkoutUrl,
      qrCode,
      amount: payment.amount,
      expiredAt: expiresAt?.toISOString() ?? null,
      payment,
    };
  }

  private createPayosClient(credentials: PayosCredentials): PayOS {
    return new PayOS({
      apiKey: credentials.apiKey,
      checksumKey: credentials.checksumKey,
      clientId: credentials.clientId,
      logLevel: 'off',
      maxRetries: 2,
      timeout: 30000,
    });
  }

  private async verifyPayosWebhook(
    credentials: PayosCredentials,
    webhook: Webhook,
  ): Promise<WebhookData> {
    const payos = this.createPayosClient(credentials);

    try {
      return await payos.webhooks.verify(webhook);
    } catch {
      throw new BadRequestException({
        code: 'PAYOS_WEBHOOK_INVALID',
        message: 'payOS webhook could not be verified.',
      });
    }
  }

  private getPaidWebhookValidationFailure(
    payment: PaymentWebhookRecord,
    verifiedData: WebhookData,
  ): string | undefined {
    if (verifiedData.orderCode !== payment.providerOrderCode) {
      return 'PAYOS_ORDER_CODE_MISMATCH';
    }

    if (verifiedData.amount !== payment.amount) {
      return 'PAYOS_AMOUNT_MISMATCH';
    }

    if (verifiedData.currency !== payment.currency) {
      return 'PAYOS_CURRENCY_MISMATCH';
    }

    if (
      payment.providerPaymentLinkId &&
      verifiedData.paymentLinkId &&
      payment.providerPaymentLinkId !== verifiedData.paymentLinkId
    ) {
      return 'PAYOS_PAYMENT_LINK_MISMATCH';
    }

    if (payment.order.totalAmount !== payment.amount) {
      return 'ORDER_PAYMENT_AMOUNT_MISMATCH';
    }

    if (payment.order.currency !== payment.currency) {
      return 'ORDER_PAYMENT_CURRENCY_MISMATCH';
    }

    return undefined;
  }

  private classifyPayosWebhook(
    webhook: Webhook,
    verifiedData: WebhookData,
  ): PayosWebhookClassification {
    const webhookCode = webhook.code?.toUpperCase() ?? '';
    const dataCode = verifiedData.code?.toUpperCase() ?? '';
    const statusText = `${webhook.desc ?? ''} ${verifiedData.desc ?? ''}`
      .toUpperCase()
      .replace(/\s+/g, ' ');

    if (webhook.success && webhookCode === '00' && dataCode === '00') {
      return PaymentStatus.PAID;
    }

    if (statusText.includes('EXPIRED') || dataCode.includes('EXPIRED')) {
      return PaymentStatus.EXPIRED;
    }

    if (statusText.includes('CANCEL') || dataCode.includes('CANCEL')) {
      return PaymentStatus.CANCELLED;
    }

    return PaymentStatus.FAILED;
  }

  private getDisplayStatusMessage(
    payment: PaymentDisplayRecord,
    source: 'return' | 'cancel',
  ): string {
    if (payment.status === PaymentStatus.PAID) {
      return 'Payment is marked paid by a verified payOS webhook.';
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      return 'Payment is cancelled.';
    }

    if (payment.status === PaymentStatus.EXPIRED) {
      return 'Payment is expired.';
    }

    if (payment.status === PaymentStatus.FAILED) {
      return 'Payment failed provider or backend validation.';
    }

    if (
      payment.order.status === OrderStatus.EXPIRED ||
      this.isOrderExpired(payment.order, new Date())
    ) {
      return 'Order is expired. This display endpoint does not refresh provider state.';
    }

    if (source === 'cancel') {
      return 'Payment is still pending locally unless a verified payOS webhook updates it.';
    }

    return 'Payment is pending until a verified payOS webhook updates it.';
  }

  private canReadPayment(
    user: AuthenticatedUser,
    payment: PaymentDisplayRecord,
  ): boolean {
    return user.role === UserRole.ADMIN || payment.order.userId === user.id;
  }

  private toSafePayment(payment: PaymentRecord): PaymentRecord {
    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      providerOrderCode: payment.providerOrderCode,
      checkoutUrl: payment.checkoutUrl,
      providerPaymentLinkId: payment.providerPaymentLinkId,
      providerTransactionReference: payment.providerTransactionReference,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paidAt: payment.paidAt,
      cancelledAt: payment.cancelledAt,
    };
  }

  private assertWebhookPayload(body: unknown): Webhook {
    if (!this.isRecord(body)) {
      throw new BadRequestException({
        code: 'PAYOS_WEBHOOK_INVALID',
        message: 'payOS webhook payload is invalid.',
      });
    }

    const data = body.data;

    if (
      typeof body.code !== 'string' ||
      typeof body.desc !== 'string' ||
      typeof body.success !== 'boolean' ||
      typeof body.signature !== 'string' ||
      !this.isRecord(data)
    ) {
      throw new BadRequestException({
        code: 'PAYOS_WEBHOOK_INVALID',
        message: 'payOS webhook payload is invalid.',
      });
    }

    return body as Webhook;
  }

  private assertVerifiedWebhookData(verifiedData: WebhookData): void {
    if (
      !Number.isSafeInteger(verifiedData.orderCode) ||
      verifiedData.orderCode < 1 ||
      verifiedData.orderCode > MAX_POSTGRES_INT ||
      !Number.isSafeInteger(verifiedData.amount) ||
      verifiedData.amount < 0 ||
      verifiedData.amount > MAX_POSTGRES_INT ||
      typeof verifiedData.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(verifiedData.currency)
    ) {
      throw new BadRequestException({
        code: 'PAYOS_WEBHOOK_DATA_INVALID',
        message: 'Verified payOS webhook data is invalid.',
      });
    }
  }

  private sanitizeWebhookMetadata(
    webhook: Webhook,
    verifiedData: WebhookData,
  ): Prisma.InputJsonObject {
    const metadata: Record<string, string | number | boolean> = {
      amount: verifiedData.amount,
      code: verifiedData.code,
      currency: verifiedData.currency,
      desc: verifiedData.desc,
      orderCode: verifiedData.orderCode,
      paymentLinkId: verifiedData.paymentLinkId,
      success: webhook.success,
      webhookCode: webhook.code,
      webhookDesc: webhook.desc,
    };

    if (verifiedData.reference) {
      metadata.referenceHash = this.hashValue(verifiedData.reference);
    }

    if (verifiedData.transactionDateTime) {
      metadata.transactionDateTime = verifiedData.transactionDateTime;
    }

    return metadata as Prisma.InputJsonObject;
  }

  private buildWebhookEventKey(
    verifiedData: WebhookData,
    signatureHash: string,
  ): string {
    return [
      'payos',
      String(verifiedData.orderCode),
      signatureHash,
    ].join(':');
  }

  private buildRedirectUrl(
    baseUrl: string,
    orderId: string,
    orderCode: number,
  ): string {
    const redirectUrl = new URL(baseUrl);

    redirectUrl.searchParams.set('orderId', orderId);
    redirectUrl.searchParams.set('orderCode', String(orderCode));

    return redirectUrl.toString();
  }

  private truncatePayosItemName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');

    return normalized.length > 120 ? normalized.slice(0, 120) : normalized;
  }

  private truncateProviderReference(
    value: string | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    return value.length > 120 ? value.slice(0, 120) : value;
  }

  private getPayosCheckoutConfig(): PayosCheckoutConfig {
    const config = {
      ...this.getPayosCredentials(),
      returnUrl: this.getRequiredUrlConfig('PAYMENT_RETURN_URL'),
      cancelUrl: this.getRequiredUrlConfig('PAYMENT_CANCEL_URL'),
      webhookUrl: this.getRequiredUrlConfig('PAYMENT_WEBHOOK_URL'),
    };

    if (new URL(config.webhookUrl).pathname !== PAYOS_WEBHOOK_ENDPOINT_PATH) {
      throw this.payosConfigurationException();
    }

    return config;
  }

  private getPayosCredentials(): PayosCredentials {
    return {
      clientId: this.getRequiredConfig('PAYOS_CLIENT_ID'),
      apiKey: this.getRequiredConfig('PAYOS_API_KEY'),
      checksumKey: this.getRequiredConfig('PAYOS_CHECKSUM_KEY'),
    };
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw this.payosConfigurationException();
    }

    return value;
  }

  private getRequiredUrlConfig(key: string): string {
    const value = this.getRequiredConfig(key);

    try {
      const parsedUrl = new URL(value);
      const validProtocol =
        parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
      const productionProtocolValid =
        process.env.NODE_ENV !== 'production' || parsedUrl.protocol === 'https:';

      if (
        !validProtocol ||
        !productionProtocolValid ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        throw new Error('Invalid payment URL.');
      }

      return parsedUrl.toString();
    } catch {
      throw this.payosConfigurationException();
    }
  }

  private payosConfigurationException() {
    return new ServiceUnavailableException({
      code: 'PAYOS_CONFIGURATION_ERROR',
      message: 'payOS payment is not configured.',
    });
  }

  private payosProviderException(error: unknown) {
    if (error instanceof APIError) {
      return new ServiceUnavailableException({
        code: 'PAYOS_PROVIDER_ERROR',
        message: 'payOS payment link could not be created.',
      });
    }

    return new ServiceUnavailableException({
      code: 'PAYOS_PROVIDER_ERROR',
      message: 'payOS payment link could not be created.',
    });
  }

  private paymentNotFoundException() {
    return new NotFoundException({
      code: 'PAYMENT_NOT_FOUND',
      message: 'Payment was not found.',
    });
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private getUniqueConstraintTarget(error: unknown): string {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return '';
    }

    const target = error.meta?.target;
    const rawTarget = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';

    return rawTarget.replace(/[^A-Za-z0-9_,.-]/g, '').slice(0, 160);
  }

  private isWebhookEventUniqueConstraintTarget(target: string): boolean {
    if (!target) {
      return false;
    }

    const normalized = target.toLowerCase();
    const fields = new Set(
      normalized.split(',').map((field) => field.trim()).filter(Boolean),
    );

    return (
      normalized.includes(
        'paymentwebhookevent_provider_eventkey_key',
      ) ||
      (fields.has('provider') && fields.has('eventkey'))
    );
  }
}
