import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus, PaymentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService, type EmailReadiness } from './email.service';

const FALSE_CONFIG_VALUES = new Set(['0', 'false', 'no', 'off']);
const TRUE_CONFIG_VALUES = new Set(['1', 'true', 'yes', 'on']);

const orderEmailItemSelect = {
  productName: true,
  sku: true,
  size: true,
  color: true,
  unitPrice: true,
  quantity: true,
  lineTotal: true,
} as const satisfies Prisma.OrderItemSelect;

const orderEmailPaymentSelect = {
  id: true,
  status: true,
  amount: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
} as const satisfies Prisma.PaymentSelect;

const orderEmailSelect = {
  id: true,
  orderCode: true,
  shippingRecipientName: true,
  status: true,
  subtotalAmount: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
  expiresAt: true,
  user: {
    select: {
      email: true,
      name: true,
    },
  },
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    select: orderEmailItemSelect,
  },
  payments: {
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    select: orderEmailPaymentSelect,
  },
} as const satisfies Prisma.OrderSelect;

type OrderEmailRecord = Prisma.OrderGetPayload<{
  select: typeof orderEmailSelect;
}>;

type OrderEmailPaymentRecord = OrderEmailRecord['payments'][number];

type OrderEmailEvent =
  | 'ORDER_CREATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'ORDER_CANCELLED'
  | 'ORDER_EXPIRED';

type OrderEmailsEnabledState =
  | 'auto'
  | 'disabled'
  | 'enabled'
  | 'unrecognized_auto';

interface EmailContent {
  html: string;
  subject: string;
  text: string;
}

export interface OrderEmailReadiness extends EmailReadiness {
  orderEmailReady: boolean;
  orderEmailsEnabled: boolean;
  orderEmailsEnabledKeyPresent: boolean;
  orderEmailsEnabledState: OrderEmailsEnabledState;
}

@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly prismaService: PrismaService,
  ) {}

  getReadiness(): OrderEmailReadiness {
    const emailReadiness = this.emailService.getReadiness();
    const orderEmailFlag = this.getOrderEmailsEnabledFlagState();
    const orderEmailsEnabled =
      orderEmailFlag.state === 'disabled'
        ? false
        : orderEmailFlag.state === 'enabled'
          ? true
          : emailReadiness.emailProviderReady;

    return {
      ...emailReadiness,
      orderEmailReady: orderEmailsEnabled && emailReadiness.emailProviderReady,
      orderEmailsEnabled,
      orderEmailsEnabledKeyPresent: orderEmailFlag.keyPresent,
      orderEmailsEnabledState: orderEmailFlag.state,
    };
  }

  async sendOrderCreatedEmail(orderId: string): Promise<boolean> {
    return this.sendOrderEmail('ORDER_CREATED', orderId, undefined, (order) => {
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        return null;
      }

      return {
        subject: `Belikeme order ${order.orderCode} is pending payment`,
        text: this.buildTextEmail(
          order,
          'Thanks for your order.',
          [
            'We received your order and it is waiting for payment.',
            order.expiresAt
              ? `Please complete payment before ${this.formatDate(order.expiresAt)}.`
              : undefined,
          ],
        ),
        html: this.buildHtmlEmail(
          order,
          'Thanks for your order.',
          [
            'We received your order and it is waiting for payment.',
            order.expiresAt
              ? `Please complete payment before ${this.formatDate(order.expiresAt)}.`
              : undefined,
          ],
        ),
      };
    });
  }

  async sendPaymentSuccessEmail(
    orderId: string,
    paymentId: string,
  ): Promise<boolean> {
    return this.sendOrderEmail('PAYMENT_SUCCESS', orderId, paymentId, (order) => {
      const payment = this.getPayment(order, paymentId);

      if (
        order.status !== OrderStatus.PAID ||
        payment?.status !== PaymentStatus.PAID
      ) {
        return null;
      }

      return {
        subject: `Belikeme payment confirmed for order ${order.orderCode}`,
        text: this.buildTextEmail(
          order,
          'Payment confirmed.',
          [
            'Your payment has been verified and your order is now paid.',
            payment.paidAt
              ? `Payment confirmed at ${this.formatDate(payment.paidAt)}.`
              : undefined,
          ],
        ),
        html: this.buildHtmlEmail(
          order,
          'Payment confirmed.',
          [
            'Your payment has been verified and your order is now paid.',
            payment.paidAt
              ? `Payment confirmed at ${this.formatDate(payment.paidAt)}.`
              : undefined,
          ],
        ),
      };
    });
  }

  async sendPaymentFailedEmail(
    orderId: string,
    paymentId: string,
    reason?: string,
  ): Promise<boolean> {
    return this.sendOrderEmail('PAYMENT_FAILED', orderId, paymentId, (order) => {
      const payment = this.getPayment(order, paymentId);

      if (
        !payment ||
        !this.isPaymentFailureNotificationStatus(payment.status)
      ) {
        return null;
      }

      const headline = this.getPaymentFailureHeadline(payment.status);
      const message = this.getPaymentFailureMessage(payment.status, reason);

      return {
        subject: `Belikeme ${headline.toLowerCase()} for order ${order.orderCode}`,
        text: this.buildTextEmail(order, `${headline}.`, [message]),
        html: this.buildHtmlEmail(order, `${headline}.`, [message]),
      };
    });
  }

  async sendOrderCancelledEmail(orderId: string): Promise<boolean> {
    return this.sendOrderEmail('ORDER_CANCELLED', orderId, undefined, (order) => {
      if (order.status !== OrderStatus.CANCELLED) {
        return null;
      }

      return {
        subject: `Belikeme order ${order.orderCode} was cancelled`,
        text: this.buildTextEmail(order, 'Order cancelled.', [
          'Your pending order has been cancelled. No payment has been confirmed for this order.',
        ]),
        html: this.buildHtmlEmail(order, 'Order cancelled.', [
          'Your pending order has been cancelled. No payment has been confirmed for this order.',
        ]),
      };
    });
  }

  async sendOrderExpiredEmail(orderId: string): Promise<boolean> {
    return this.sendOrderEmail('ORDER_EXPIRED', orderId, undefined, (order) => {
      if (order.status !== OrderStatus.EXPIRED) {
        return null;
      }

      return {
        subject: `Belikeme order ${order.orderCode} expired`,
        text: this.buildTextEmail(order, 'Order expired.', [
          'Your pending order expired before payment was confirmed.',
        ]),
        html: this.buildHtmlEmail(order, 'Order expired.', [
          'Your pending order expired before payment was confirmed.',
        ]),
      };
    });
  }

  private async sendOrderEmail(
    event: OrderEmailEvent,
    orderId: string,
    paymentId: string | undefined,
    buildContent: (order: OrderEmailRecord) => EmailContent | null,
  ): Promise<boolean> {
    try {
      if (!this.shouldAttemptEmail(event, orderId, paymentId)) {
        return false;
      }

      const order = await this.prismaService.order.findUnique({
        where: {
          id: orderId,
        },
        select: orderEmailSelect,
      });

      if (!order) {
        this.log('warn', 'ORDER_EMAIL_SKIPPED_ORDER_NOT_FOUND', {
          event,
          orderId,
          paymentId,
          ...this.getSafeLogReadiness(),
        });
        return false;
      }

      const content = buildContent(order);

      if (!content) {
        this.log('warn', 'ORDER_EMAIL_SKIPPED_INVALID_STATE', {
          event,
          orderId,
          orderStatus: order.status,
          paymentId,
          paymentStatus: paymentId
            ? this.getPayment(order, paymentId)?.status ?? null
            : undefined,
          ...this.getSafeLogReadiness(),
        });
        return false;
      }

      const recipientEmail = order.user.email;
      if (!recipientEmail) {
        this.log('warn', 'ORDER_EMAIL_SKIPPED_NO_RECIPIENT', {
          event,
          orderId,
          paymentId,
          recipientPresent: false,
          ...this.getSafeLogReadiness(),
        });
        return false;
      }

      const logContext = {
        event,
        orderId,
        paymentId,
        recipientPresent: true,
        ...this.getSafeLogReadiness(),
      };

      this.log('log', 'ORDER_EMAIL_ATTEMPT', logContext);

      const sent = await this.emailService.sendTransactionalEmail({
        to: recipientEmail,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      this.log(
        sent ? 'log' : 'warn',
        sent ? 'ORDER_EMAIL_SENT' : 'ORDER_EMAIL_NOT_SENT',
        {
          ...logContext,
          failure: sent ? undefined : this.getNotSentFailureSummary(),
        },
      );

      return sent;
    } catch (error) {
      this.log('warn', 'ORDER_EMAIL_SEND_FAILED', {
        event,
        orderId,
        paymentId,
        error: {
          name: error instanceof Error ? error.name : 'UnknownError',
          safeMessageSummary:
            'Order email attempt failed before provider send.',
        },
        ...this.getSafeLogReadiness(),
      });
      return false;
    }
  }

  private shouldAttemptEmail(
    event: OrderEmailEvent,
    orderId: string,
    paymentId: string | undefined,
  ): boolean {
    const orderEmailFlag = this.getOrderEmailsEnabledFlagState();

    if (orderEmailFlag.state === 'disabled') {
      this.log('warn', 'ORDER_EMAIL_SKIPPED_DISABLED', {
        event,
        orderId,
        paymentId,
        ...this.getSafeLogReadiness(),
      });
      return false;
    }

    if (orderEmailFlag.state === 'enabled') {
      return true;
    }

    if (!this.emailService.isConfigured()) {
      this.log('warn', 'EMAIL_PROVIDER_NOT_CONFIGURED', {
        emailType: event,
        orderId,
        paymentId,
        ...this.getSafeLogReadiness(),
      });
      this.log('warn', 'ORDER_EMAIL_SKIPPED_EMAIL_PROVIDER_NOT_CONFIGURED', {
        event,
        orderId,
        paymentId,
        ...this.getSafeLogReadiness(),
      });
      return false;
    }

    return true;
  }

  private getOrderEmailsEnabledFlagState(): {
    keyPresent: boolean;
    state: OrderEmailsEnabledState;
  } {
    const rawValue = this.configService.get<string | boolean>(
      'ORDER_EMAILS_ENABLED',
    );
    const keyPresent = rawValue !== undefined && rawValue !== null;
    const normalized = keyPresent
      ? String(rawValue).trim().toLowerCase()
      : undefined;

    if (!normalized) {
      return {
        keyPresent,
        state: 'auto',
      };
    }

    if (FALSE_CONFIG_VALUES.has(normalized)) {
      return {
        keyPresent,
        state: 'disabled',
      };
    }

    if (TRUE_CONFIG_VALUES.has(normalized)) {
      return {
        keyPresent,
        state: 'enabled',
      };
    }

    return {
      keyPresent,
      state: 'unrecognized_auto',
    };
  }

  private getSafeLogReadiness(): Record<string, unknown> {
    const readiness = this.getReadiness();

    return {
      emailFromPresent: readiness.emailFromPresent,
      emailProvider: readiness.emailProvider,
      emailProviderPresent: readiness.emailProviderPresent,
      emailProviderReady: readiness.emailProviderReady,
      emailProviderSupported: readiness.emailProviderSupported,
      orderEmailReady: readiness.orderEmailReady,
      orderEmailsEnabled: readiness.orderEmailsEnabled,
      orderEmailsEnabledKeyPresent: readiness.orderEmailsEnabledKeyPresent,
      orderEmailsEnabledState: readiness.orderEmailsEnabledState,
      resendApiKeyPresent: readiness.resendApiKeyPresent,
      smtpAuthConfigured: readiness.smtpAuthConfigured,
      smtpConfigured: readiness.smtpConfigured,
      smtpFromPresent: readiness.smtpFromPresent,
      smtpHostPresent: readiness.smtpHostPresent,
      smtpPassPresent: readiness.smtpPassPresent,
      smtpPortPresent: readiness.smtpPortPresent,
      smtpPortValid: readiness.smtpPortValid,
      smtpUserPresent: readiness.smtpUserPresent,
    };
  }

  private getNotSentFailureSummary() {
    const readiness = this.emailService.getReadiness();

    return {
      code: this.emailService.isConfigured()
        ? `${readiness.emailProvider.toUpperCase()}_SEND_FAILED`
        : 'EMAIL_PROVIDER_NOT_CONFIGURED',
      safeMessageSummary:
        'Transactional email was not accepted for delivery by the configured email provider.',
    };
  }

  private buildTextEmail(
    order: OrderEmailRecord,
    headline: string,
    messages: Array<string | undefined>,
  ): string {
    const customerName =
      order.user?.name?.trim() || order.shippingRecipientName?.trim() || 'there';
    const parts = [
      `Hi ${customerName},`,
      '',
      headline,
      ...messages.filter((message): message is string => Boolean(message)),
      '',
      `Order code: ${order.orderCode}`,
      `Status: ${this.formatStatus(order.status)}`,
      `Created: ${this.formatDate(order.createdAt)}`,
      order.expiresAt ? `Expires: ${this.formatDate(order.expiresAt)}` : undefined,
      '',
      'Items:',
      ...order.items.map((item) => this.formatTextItem(item, order.currency)),
      '',
      `Subtotal: ${this.formatCurrency(order.subtotalAmount, order.currency)}`,
      `Total: ${this.formatCurrency(order.totalAmount, order.currency)}`,
      '',
      'Thank you for shopping with Belikeme.',
    ];

    return parts.filter((part): part is string => part !== undefined).join('\n');
  }

  private buildHtmlEmail(
    order: OrderEmailRecord,
    headline: string,
    messages: Array<string | undefined>,
  ): string {
    const customerName = this.escapeHtml(
      order.user?.name?.trim() || order.shippingRecipientName?.trim() || 'there',
    );
    const messageHtml = messages
      .filter((message): message is string => Boolean(message))
      .map((message) => `<p>${this.escapeHtml(message)}</p>`)
      .join('');
    const itemRows = order.items
      .map(
        (item) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">
              <strong>${this.escapeHtml(item.productName)}</strong><br>
              <span style="color:#666;">${this.escapeHtml(
                this.getVariantLabel(item),
              )}</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${
              item.quantity
            }</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${this.escapeHtml(
              this.formatCurrency(item.lineTotal, order.currency),
            )}</td>
          </tr>`,
      )
      .join('');

    return `
      <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;">
        <p>Hi ${customerName},</p>
        <h2 style="margin:0 0 12px;">${this.escapeHtml(headline)}</h2>
        ${messageHtml}
        <table style="border-collapse:collapse;width:100%;margin:18px 0;">
          <tbody>
            <tr><td style="padding:4px 0;color:#666;">Order code</td><td style="padding:4px 0;text-align:right;">${this.escapeHtml(
              order.orderCode,
            )}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Status</td><td style="padding:4px 0;text-align:right;">${this.escapeHtml(
              this.formatStatus(order.status),
            )}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Created</td><td style="padding:4px 0;text-align:right;">${this.escapeHtml(
              this.formatDate(order.createdAt),
            )}</td></tr>
            ${
              order.expiresAt
                ? `<tr><td style="padding:4px 0;color:#666;">Expires</td><td style="padding:4px 0;text-align:right;">${this.escapeHtml(
                    this.formatDate(order.expiresAt),
                  )}</td></tr>`
                : ''
            }
          </tbody>
        </table>
        <table style="border-collapse:collapse;width:100%;margin:18px 0;">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px 0;">Item</th>
              <th style="text-align:center;border-bottom:1px solid #ddd;padding:8px 0;">Qty</th>
              <th style="text-align:right;border-bottom:1px solid #ddd;padding:8px 0;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <p style="text-align:right;margin:4px 0;">Subtotal: ${this.escapeHtml(
          this.formatCurrency(order.subtotalAmount, order.currency),
        )}</p>
        <p style="text-align:right;margin:4px 0;font-weight:bold;">Total: ${this.escapeHtml(
          this.formatCurrency(order.totalAmount, order.currency),
        )}</p>
        <p>Thank you for shopping with Belikeme.</p>
      </div>
    `;
  }

  private getPayment(
    order: OrderEmailRecord,
    paymentId: string,
  ): OrderEmailPaymentRecord | undefined {
    return order.payments.find((payment) => payment.id === paymentId);
  }

  private getPaymentFailureHeadline(status: PaymentStatus): string {
    if (status === PaymentStatus.CANCELLED) {
      return 'Payment cancelled';
    }

    if (status === PaymentStatus.EXPIRED) {
      return 'Payment expired';
    }

    return 'Payment could not be completed';
  }

  private isPaymentFailureNotificationStatus(
    status: PaymentStatus,
  ): status is
    | typeof PaymentStatus.CANCELLED
    | typeof PaymentStatus.EXPIRED
    | typeof PaymentStatus.FAILED {
    return (
      status === PaymentStatus.CANCELLED ||
      status === PaymentStatus.EXPIRED ||
      status === PaymentStatus.FAILED
    );
  }

  private getPaymentFailureMessage(
    status: PaymentStatus,
    reason: string | undefined,
  ): string {
    if (status === PaymentStatus.CANCELLED) {
      return 'Your payment was cancelled before it was confirmed.';
    }

    if (status === PaymentStatus.EXPIRED) {
      return 'Your payment session expired before payment was confirmed.';
    }

    if (reason === 'INSUFFICIENT_STOCK_AT_PAYMENT') {
      return 'We could not confirm this payment because one or more items became unavailable. If your bank shows a deduction, please contact support with your order code.';
    }

    return 'We could not confirm this payment for your order. If your bank shows a deduction, please contact support with your order code.';
  }

  private formatTextItem(
    item: OrderEmailRecord['items'][number],
    currency: string,
  ): string {
    return `- ${item.productName} (${this.getVariantLabel(item)}) x ${
      item.quantity
    } - ${this.formatCurrency(item.lineTotal, currency)}`;
  }

  private getVariantLabel(item: OrderEmailRecord['items'][number]): string {
    return [item.sku, item.size, item.color]
      .filter((value): value is string => Boolean(value))
      .join(' / ');
  }

  private formatCurrency(amount: number, currency: string): string {
    if (currency === 'VND' && Number.isSafeInteger(amount)) {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(amount);
    }

    return `${amount} ${currency}`;
  }

  private formatDate(value: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(value);
  }

  private formatStatus(status: OrderStatus): string {
    return status.replace(/_/g, ' ').toLowerCase();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private log(
    level: 'log' | 'warn',
    code: string,
    data: Record<string, unknown>,
  ) {
    const message = JSON.stringify({
      code,
      ...data,
    });

    if (level === 'log') {
      this.logger.log(message);
      return;
    }

    this.logger.warn(message);
  }
}
