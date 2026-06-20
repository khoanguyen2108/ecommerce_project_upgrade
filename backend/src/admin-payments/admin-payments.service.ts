import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminPaymentOrder,
  AdminPaymentQueryDto,
  AdminPaymentSort,
} from './dto/admin-payment-query.dto';

const DEFAULT_ADMIN_PAYMENT_LIMIT = 20;
const MAX_ADMIN_PAYMENT_LIMIT = 100;
const MAX_POSTGRES_INT = 2_147_483_647;
const PAYOS_WEBHOOK_ENDPOINT_PATH = '/payments/payos/webhook';

const adminPaymentUserSummarySelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
} as const satisfies Prisma.UserSelect;

const adminPaymentOrderBaseSelect = {
  id: true,
  userId: true,
  status: true,
  subtotalAmount: true,
  totalAmount: true,
  currency: true,
  items: {
    select: {
      quantity: true,
    },
  },
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
  expiresAt: true,
} as const satisfies Prisma.OrderSelect;

const adminPaymentOrderWithUserSelect = {
  ...adminPaymentOrderBaseSelect,
  user: {
    select: adminPaymentUserSummarySelect,
  },
} as const satisfies Prisma.OrderSelect;

const adminPaymentWebhookEventSummarySelect = {
  id: true,
  provider: true,
  paymentId: true,
  orderId: true,
  receivedAt: true,
  processedAt: true,
  processingStatus: true,
} as const satisfies Prisma.PaymentWebhookEventSelect;

const adminPaymentListSelect = {
  id: true,
  orderId: true,
  provider: true,
  status: true,
  amount: true,
  currency: true,
  providerOrderCode: true,
  providerPaymentLinkId: true,
  providerTransactionReference: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
  order: {
    select: adminPaymentOrderWithUserSelect,
  },
} as const satisfies Prisma.PaymentSelect;

const adminPaymentDetailSelect = {
  ...adminPaymentListSelect,
  checkoutUrl: true,
  webhookEvents: {
    orderBy: {
      receivedAt: 'desc',
    },
    select: adminPaymentWebhookEventSummarySelect,
  },
} as const satisfies Prisma.PaymentSelect;

type AdminPaymentListRecord = Prisma.PaymentGetPayload<{
  select: typeof adminPaymentListSelect;
}>;

type AdminPaymentDetailRecord = Prisma.PaymentGetPayload<{
  select: typeof adminPaymentDetailSelect;
}>;

type AdminPaymentOrderRecord = AdminPaymentListRecord['order'];

interface DateRange {
  from?: Date;
  to?: Date;
}

interface ConfigState {
  configured: boolean;
  length: number;
  valid: boolean;
}

interface UrlConfigState extends ConfigState {
  host: string | null;
  path: string | null;
  url: string | null;
}

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async listPayments(query: AdminPaymentQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? DEFAULT_ADMIN_PAYMENT_LIMIT,
      MAX_ADMIN_PAYMENT_LIMIT,
    );
    const where = this.buildPaymentWhere(query);

    const [total, payments] = await this.prismaService.$transaction([
      this.prismaService.payment.count({ where }),
      this.prismaService.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.getOrderBy(query.sort, query.order),
        select: adminPaymentListSelect,
      }),
    ]);

    return {
      payments: payments.map((payment) => this.toPaymentSummary(payment)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getPayment(id: string) {
    const payment = await this.prismaService.payment.findUnique({
      where: { id },
      select: adminPaymentDetailSelect,
    });

    if (!payment) {
      throw this.paymentNotFoundException();
    }

    return {
      payment: this.toPaymentDetail(payment),
    };
  }

  getPayosReadiness() {
    const clientId = this.getRequiredConfigState('PAYOS_CLIENT_ID');
    const apiKey = this.getRequiredConfigState('PAYOS_API_KEY');
    const checksumKey = this.getRequiredConfigState('PAYOS_CHECKSUM_KEY');
    const returnUrl = this.getUrlConfigState('PAYMENT_RETURN_URL');
    const cancelUrl = this.getUrlConfigState('PAYMENT_CANCEL_URL');
    const webhookUrl = this.getUrlConfigState('PAYMENT_WEBHOOK_URL');
    const backendUrl = this.getUrlConfigState('BACKEND_URL');
    const webhookPathMatches =
      webhookUrl.path === PAYOS_WEBHOOK_ENDPOINT_PATH;
    const warnings = [
      ...this.getConfigWarnings('PAYOS_CLIENT_ID', clientId),
      ...this.getConfigWarnings('PAYOS_API_KEY', apiKey),
      ...this.getConfigWarnings('PAYOS_CHECKSUM_KEY', checksumKey),
      ...this.getConfigWarnings('PAYMENT_RETURN_URL', returnUrl, true),
      ...this.getConfigWarnings('PAYMENT_CANCEL_URL', cancelUrl, true),
      ...this.getConfigWarnings('PAYMENT_WEBHOOK_URL', webhookUrl, true),
      ...this.getOptionalUrlWarnings('BACKEND_URL', backendUrl),
      ...(webhookUrl.valid && !webhookPathMatches
        ? [
            `PAYMENT_WEBHOOK_URL must end with ${PAYOS_WEBHOOK_ENDPOINT_PATH}.`,
          ]
        : []),
    ];
    const environmentReady =
      clientId.configured &&
      apiKey.configured &&
      checksumKey.configured &&
      returnUrl.valid &&
      cancelUrl.valid &&
      webhookUrl.valid &&
      webhookPathMatches;

    return {
      readiness: {
        payosClientIdConfigured: clientId.configured,
        payosApiKeyConfigured: apiKey.configured,
        payosChecksumKeyConfigured: checksumKey.configured,
        returnUrlConfigured: returnUrl.configured,
        cancelUrlConfigured: cancelUrl.configured,
        webhookUrlConfigured: webhookUrl.configured,
        webhookPathMatches,
        backendUrlConfigured: backendUrl.configured,
        environmentReady,
        credentials: {
          clientId: this.toSafeSecretState(clientId),
          apiKey: this.toSafeSecretState(apiKey),
          checksumKey: this.toSafeSecretState(checksumKey),
        },
        urls: {
          return: this.toSafeUrlState(returnUrl),
          cancel: this.toSafeUrlState(cancelUrl),
          webhook: this.toSafeUrlState(webhookUrl),
          backend: this.toSafeUrlState(backendUrl),
        },
        webhookEndpointPath: PAYOS_WEBHOOK_ENDPOINT_PATH,
        warnings,
      },
    };
  }

  private buildPaymentWhere(
    query: AdminPaymentQueryDto,
  ): Prisma.PaymentWhereInput {
    const dateRange = this.parseDateRange(query);
    const where: Prisma.PaymentWhereInput = {};
    const search = this.normalizeOptionalQueryText(query.search);

    if (query.status) {
      where.status = query.status;
    }

    if (query.provider) {
      where.provider = query.provider;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.userId) {
      where.order = {
        userId: query.userId,
      };
    }

    if (dateRange.from || dateRange.to) {
      where.createdAt = this.buildDateTimeFilter(dateRange);
    }

    if (search) {
      where.OR = this.buildSearchWhere(search);
    }

    return where;
  }

  private buildSearchWhere(search: string): Prisma.PaymentWhereInput[] {
    const searchWhere: Prisma.PaymentWhereInput[] = [
      {
        order: {
          user: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        providerPaymentLinkId: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        providerTransactionReference: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
    const uuid = this.parseUuidSearch(search);
    const providerOrderCode = this.parseProviderOrderCodeSearch(search);

    if (uuid) {
      searchWhere.push({ id: uuid }, { orderId: uuid });
    }

    if (providerOrderCode !== undefined) {
      searchWhere.push({
        providerOrderCode,
      });
    }

    return searchWhere;
  }

  private getOrderBy(
    sort: AdminPaymentSort = 'createdAt',
    order: AdminPaymentOrder = 'desc',
  ): Prisma.PaymentOrderByWithRelationInput[] {
    return [
      { [sort]: order } as Prisma.PaymentOrderByWithRelationInput,
      { id: 'asc' },
    ];
  }

  private parseDateRange(query: AdminPaymentQueryDto): DateRange {
    const from = this.parseDateBoundary(query.from, 'from');
    const to = this.parseDateBoundary(query.to, 'to');

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException({
        code: 'ADMIN_PAYMENT_QUERY_INVALID',
        message: 'from must be before or equal to to.',
      });
    }

    return { from, to };
  }

  private parseDateBoundary(
    value: string | undefined,
    boundary: 'from' | 'to',
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({
        code: 'ADMIN_PAYMENT_QUERY_INVALID',
        message: 'Date range values must be valid ISO 8601 dates.',
      });
    }

    if (boundary === 'to' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(23, 59, 59, 999);
    }

    return date;
  }

  private buildDateTimeFilter(dateRange: DateRange): Prisma.DateTimeFilter {
    const filter: Prisma.DateTimeFilter = {};

    if (dateRange.from) {
      filter.gte = dateRange.from;
    }

    if (dateRange.to) {
      filter.lte = dateRange.to;
    }

    return filter;
  }

  private toPaymentSummary(payment: AdminPaymentListRecord) {
    return {
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      providerOrderCode: payment.providerOrderCode,
      providerPaymentLinkId: payment.providerPaymentLinkId,
      providerTransactionReference: payment.providerTransactionReference,
      failureReason: payment.failureReason,
      order: this.toOrderSummary(payment.order),
      user: payment.order.user,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paidAt: payment.paidAt,
      cancelledAt: payment.cancelledAt,
    };
  }

  private toPaymentDetail(payment: AdminPaymentDetailRecord) {
    return {
      ...this.toPaymentSummary(payment),
      orderId: payment.orderId,
      checkoutUrl: payment.checkoutUrl,
      webhookEvents: payment.webhookEvents,
    };
  }

  private toOrderSummary(order: AdminPaymentOrderRecord) {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      subtotalAmount: order.subtotalAmount,
      totalAmount: order.totalAmount,
      currency: order.currency,
      itemCount: this.getItemCount(order.items),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
      expiresAt: order.expiresAt,
    };
  }

  private getItemCount(items: Array<{ quantity: number }>): number {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  private getRequiredConfigState(key: string): ConfigState {
    const value = this.configService.get<string>(key)?.trim() ?? '';
    const configured = Boolean(value);

    return {
      configured,
      length: value.length,
      valid: configured,
    };
  }

  private getUrlConfigState(key: string): UrlConfigState {
    const value = this.configService.get<string>(key)?.trim();
    const configured = Boolean(value);

    if (!value) {
      return {
        configured,
        host: null,
        length: 0,
        path: null,
        url: null,
        valid: false,
      };
    }

    try {
      const parsedUrl = new URL(value);
      const validProtocol =
        parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
      const productionProtocolValid =
        process.env.NODE_ENV !== 'production' || parsedUrl.protocol === 'https:';
      const valid =
        validProtocol &&
        productionProtocolValid &&
        !parsedUrl.username &&
        !parsedUrl.password;
      const safeUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;

      return {
        configured,
        host: parsedUrl.host,
        length: value.length,
        path: parsedUrl.pathname,
        url: valid ? safeUrl : null,
        valid,
      };
    } catch {
      return {
        configured,
        host: null,
        length: value.length,
        path: null,
        url: null,
        valid: false,
      };
    }
  }

  private toSafeSecretState(state: ConfigState) {
    return {
      present: state.configured,
      length: state.length,
    };
  }

  private toSafeUrlState(state: UrlConfigState) {
    return {
      configured: state.configured,
      valid: state.valid,
      host: state.host,
      url: state.url,
    };
  }

  private getConfigWarnings(
    key: string,
    state: ConfigState,
    requiresValidUrl = false,
  ): string[] {
    if (!state.configured) {
      return [`${key} is not configured.`];
    }

    if (requiresValidUrl && !state.valid) {
      return [`${key} is not a valid absolute URL.`];
    }

    return [];
  }

  private getOptionalUrlWarnings(key: string, state: ConfigState): string[] {
    if (state.configured && !state.valid) {
      return [`${key} is not a valid absolute URL.`];
    }

    return [];
  }

  private normalizeOptionalQueryText(value: string | undefined): string | undefined {
    const normalized = value?.trim().replace(/\s+/g, ' ');

    return normalized ? normalized : undefined;
  }

  private parseUuidSearch(search: string): string | undefined {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      search,
    )
      ? search
      : undefined;
  }

  private parseProviderOrderCodeSearch(search: string): number | undefined {
    if (!/^\d+$/.test(search)) {
      return undefined;
    }

    const value = Number(search);

    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > MAX_POSTGRES_INT
    ) {
      return undefined;
    }

    return value;
  }

  private paymentNotFoundException() {
    return new NotFoundException({
      code: 'ADMIN_PAYMENT_NOT_FOUND',
      message: 'Payment was not found.',
    });
  }
}
