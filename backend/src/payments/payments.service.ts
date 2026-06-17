import {
  BadRequestException,
  Injectable,
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
import { Prisma } from '../generated/prisma/client';
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePayosPaymentDto } from './dto/create-payos-payment.dto';
import type { PayosStatusQueryDto } from './dto/payos-status-query.dto';

const PAYMENT_PROVIDER = PaymentProvider.PAYOS;
const DEFAULT_CURRENCY = 'VND';
const PAYOS_DESCRIPTION_PREFIX = 'Belikeme';
const WEBHOOK_STATUS_PROCESSED = 'PROCESSED';
const WEBHOOK_STATUS_IGNORED = 'IGNORED';

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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async createPayosPayment(
    user: AuthenticatedUser,
    dto: CreatePayosPaymentDto,
  ) {
    const order = await this.getOrderForPayment(user, dto.orderId);

    this.assertOrderPayable(order, new Date());
    const config = this.getPayosCheckoutConfig();
    const payment = await this.getOrCreatePendingPayosPayment(order);

    if (payment.checkoutUrl) {
      return {
        checkoutUrl: payment.checkoutUrl,
        payment,
      };
    }

    const paymentLink = await this.createPayosPaymentLink(
      config,
      order,
      payment,
    );
    const updateResult = await this.prismaService.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
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

    return {
      checkoutUrl: updatedPayment.checkoutUrl,
      payment: updatedPayment,
    };
  }

  async handlePayosWebhook(body: unknown) {
    const credentials = this.getPayosCredentials();
    const webhook = this.assertWebhookPayload(body);
    const verifiedData = await this.verifyPayosWebhook(credentials, webhook);
    const signatureHash = this.hashValue(webhook.signature);
    const eventKey = this.buildWebhookEventKey(verifiedData, signatureHash);
    const metadata = this.sanitizeWebhookMetadata(webhook, verifiedData);

    try {
      return await this.prismaService.$transaction(async (tx) => {
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

        const classification = this.classifyPayosWebhook(webhook, verifiedData);

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

        if (classification === PaymentStatus.PAID) {
          return this.processPaidWebhook(
            tx,
            event.id,
            payment,
            verifiedData,
          );
        }

        return this.processNonPaidWebhook(
          tx,
          event.id,
          payment,
          verifiedData,
          classification,
        );
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return {
          received: true,
          duplicate: true,
          status: WEBHOOK_STATUS_PROCESSED,
        };
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
    const validationFailureReason = this.getPaidWebhookValidationFailure(
      payment,
      verifiedData,
    );

    if (validationFailureReason) {
      const failedPayment = await this.failPaymentAndCancelOrder(
        tx,
        payment,
        validationFailureReason,
        verifiedData,
      );

      if (!failedPayment) {
        return this.ignoreWebhookForTerminalState(tx, eventId, payment);
      }

      await this.markWebhookEventProcessed(tx, eventId, {
        processingStatus: WEBHOOK_STATUS_PROCESSED,
      });

      return {
        received: true,
        duplicate: false,
        processed: true,
        payment: failedPayment,
        reason: validationFailureReason,
      };
    }

    if (payment.order.items.length === 0) {
      const failedPayment = await this.failPaymentAndCancelOrder(
        tx,
        payment,
        'ORDER_ITEMS_MISSING',
        verifiedData,
      );

      if (!failedPayment) {
        return this.ignoreWebhookForTerminalState(tx, eventId, payment);
      }

      await this.markWebhookEventProcessed(tx, eventId, {
        processingStatus: WEBHOOK_STATUS_PROCESSED,
      });

      return {
        received: true,
        duplicate: false,
        processed: true,
        payment: failedPayment,
        reason: 'ORDER_ITEMS_MISSING',
      };
    }

    if (!(await this.hasEnoughStockForPaidOrder(tx, payment))) {
      const failedPayment = await this.failPaymentAndCancelOrder(
        tx,
        payment,
        'INSUFFICIENT_STOCK_AT_PAYMENT',
        verifiedData,
      );

      if (!failedPayment) {
        return this.ignoreWebhookForTerminalState(tx, eventId, payment);
      }

      await this.markWebhookEventProcessed(tx, eventId, {
        processingStatus: WEBHOOK_STATUS_PROCESSED,
      });

      return {
        received: true,
        duplicate: false,
        processed: true,
        payment: failedPayment,
        reason: 'INSUFFICIENT_STOCK_AT_PAYMENT',
      };
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
      return this.ignoreWebhookForTerminalState(tx, eventId, payment);
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

    for (const item of payment.order.items) {
      const stockUpdate = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          stock: {
            gte: item.quantity,
          },
        },
        data: {
          stock: {
            decrement: item.quantity,
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

  private async failPaymentAndCancelOrder(
    tx: Prisma.TransactionClient,
    payment: PaymentWebhookRecord,
    failureReason: string,
    verifiedData: WebhookData,
  ): Promise<PaymentRecord | null> {
    const cancelledAt = new Date();
    const orderUpdate = await tx.order.updateMany({
      where: {
        id: payment.orderId,
        status: OrderStatus.PENDING_PAYMENT,
      },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt,
      },
    });

    if (orderUpdate.count !== 1) {
      return null;
    }

    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.FAILED,
        providerPaymentLinkId:
          verifiedData.paymentLinkId || payment.providerPaymentLinkId,
        providerTransactionReference: this.truncateProviderReference(
          verifiedData.reference,
        ),
        failureReason,
        cancelledAt,
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

    return updatedPayment;
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

    return payment.order.items.every((item) => {
      const currentStock = stockByVariantId.get(item.variantId);

      return currentStock !== undefined && currentStock >= item.quantity;
    });
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

    throw new ServiceUnavailableException({
      code: 'PAYOS_CHECKOUT_LINK_RACE',
      message: 'payOS checkout link creation should be retried.',
    });
  }

  private async getOrCreatePendingPayosPayment(
    order: OrderForPayment,
  ): Promise<PaymentRecord> {
    const existingPayment = await this.prismaService.payment.findUnique({
      where: {
        orderId_provider: {
          orderId: order.id,
          provider: PAYMENT_PROVIDER,
        },
      },
      select: paymentSelect,
    });

    if (existingPayment) {
      if (existingPayment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException({
          code: 'PAYMENT_NOT_PENDING',
          message: 'Payment is not pending.',
        });
      }

      if (existingPayment.amount !== order.totalAmount) {
        throw new BadRequestException({
          code: 'PAYMENT_AMOUNT_MISMATCH',
          message: 'Payment amount does not match the order total.',
        });
      }

      if (existingPayment.currency !== order.currency) {
        throw new BadRequestException({
          code: 'PAYMENT_CURRENCY_MISMATCH',
          message: 'Payment currency does not match the order currency.',
        });
      }

      return existingPayment;
    }

    return this.prismaService.payment.create({
      data: {
        orderId: order.id,
        provider: PAYMENT_PROVIDER,
        status: PaymentStatus.PENDING,
        amount: order.totalAmount,
        currency: order.currency,
      },
      select: paymentSelect,
    });
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
        items: order.items.map((item) => ({
          name: this.truncatePayosItemName(item.productName),
          quantity: item.quantity,
          price: item.unitPrice,
        })),
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
    return {
      ...this.getPayosCredentials(),
      returnUrl: this.getRequiredUrlConfig('PAYMENT_RETURN_URL'),
      cancelUrl: this.getRequiredUrlConfig('PAYMENT_CANCEL_URL'),
      webhookUrl: this.getRequiredUrlConfig('PAYMENT_WEBHOOK_URL'),
    };
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
      return new URL(value).toString();
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
}
