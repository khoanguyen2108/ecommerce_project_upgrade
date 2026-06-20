import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderEmailService } from '../email/order-email.service';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus, PaymentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminOrderOrder,
  AdminOrderQueryDto,
  AdminOrderSort,
} from './dto/admin-order-query.dto';

const DEFAULT_ADMIN_ORDER_LIMIT = 20;
const MAX_ADMIN_ORDER_LIMIT = 100;
const MAX_POSTGRES_INT = 2_147_483_647;

const adminOrderUserSummarySelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
} as const satisfies Prisma.UserSelect;

const adminOrderPaymentSummarySelect = {
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

const adminOrderItemSelect = {
  id: true,
  orderId: true,
  productId: true,
  variantId: true,
  productName: true,
  sku: true,
  size: true,
  color: true,
  unitPrice: true,
  quantity: true,
  lineTotal: true,
  createdAt: true,
} as const satisfies Prisma.OrderItemSelect;

const adminOrderWebhookEventSummarySelect = {
  id: true,
  provider: true,
  paymentId: true,
  orderId: true,
  receivedAt: true,
  processedAt: true,
  processingStatus: true,
} as const satisfies Prisma.PaymentWebhookEventSelect;

const adminOrderListSelect = {
  id: true,
  user: {
    select: adminOrderUserSummarySelect,
  },
  status: true,
  subtotalAmount: true,
  discountAmount: true,
  totalAmount: true,
  voucherId: true,
  voucherCodeSnapshot: true,
  voucherNameSnapshot: true,
  currency: true,
  shippingRecipientName: true,
  shippingPhone: true,
  shippingProvince: true,
  shippingDistrict: true,
  shippingWard: true,
  shippingAddressLine: true,
  shippingNote: true,
  items: {
    select: {
      quantity: true,
    },
  },
  payments: {
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    take: 1,
    select: adminOrderPaymentSummarySelect,
  },
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
  expiresAt: true,
} as const satisfies Prisma.OrderSelect;

const adminOrderDetailSelect = {
  id: true,
  user: {
    select: adminOrderUserSummarySelect,
  },
  status: true,
  subtotalAmount: true,
  discountAmount: true,
  totalAmount: true,
  voucherId: true,
  voucherCodeSnapshot: true,
  voucherNameSnapshot: true,
  currency: true,
  shippingRecipientName: true,
  shippingPhone: true,
  shippingProvince: true,
  shippingDistrict: true,
  shippingWard: true,
  shippingAddressLine: true,
  shippingNote: true,
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    select: adminOrderItemSelect,
  },
  payments: {
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: adminOrderPaymentSummarySelect,
  },
  webhookEvents: {
    orderBy: {
      receivedAt: 'desc',
    },
    select: adminOrderWebhookEventSummarySelect,
  },
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
  expiresAt: true,
} as const satisfies Prisma.OrderSelect;

type AdminOrderListRecord = Prisma.OrderGetPayload<{
  select: typeof adminOrderListSelect;
}>;

type AdminOrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof adminOrderDetailSelect;
}>;

interface DateRange {
  from?: Date;
  to?: Date;
}

type AdminOrderTransition = 'cancel' | 'expire';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly orderEmailService: OrderEmailService,
    private readonly prismaService: PrismaService,
  ) {}

  async listOrders(query: AdminOrderQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? DEFAULT_ADMIN_ORDER_LIMIT,
      MAX_ADMIN_ORDER_LIMIT,
    );
    const where = this.buildOrderWhere(query);

    const [total, orders] = await this.prismaService.$transaction([
      this.prismaService.order.count({ where }),
      this.prismaService.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.getOrderBy(query.sort, query.order),
        select: adminOrderListSelect,
      }),
    ]);

    return {
      orders: orders.map((order) => this.toOrderSummary(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getOrder(id: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id },
      select: adminOrderDetailSelect,
    });

    if (!order) {
      throw this.orderNotFoundException();
    }

    return {
      order: this.toOrderDetail(order),
    };
  }

  async cancelOrder(id: string) {
    return this.transitionPendingOrder(id, 'cancel');
  }

  async expireOrder(id: string) {
    return this.transitionPendingOrder(id, 'expire');
  }

  private async transitionPendingOrder(
    id: string,
    transition: AdminOrderTransition,
  ) {
    const order = await this.prismaService.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!currentOrder) {
        throw this.orderNotFoundException();
      }

      this.assertOrderCanTransition(currentOrder.status);

      const finalizedAt = new Date();
      const orderData =
        transition === 'cancel'
          ? {
              status: OrderStatus.CANCELLED,
              cancelledAt: finalizedAt,
            }
          : {
              status: OrderStatus.EXPIRED,
              expiresAt: currentOrder.expiresAt ?? finalizedAt,
            };
      const paymentData =
        transition === 'cancel'
          ? {
              status: PaymentStatus.CANCELLED,
              failureReason: 'ADMIN_CANCELLED_PENDING_ORDER',
              cancelledAt: finalizedAt,
            }
          : {
              status: PaymentStatus.EXPIRED,
              failureReason: 'ADMIN_EXPIRED_PENDING_ORDER',
              cancelledAt: finalizedAt,
            };
      const updateResult = await tx.order.updateMany({
        where: {
          id,
          status: OrderStatus.PENDING_PAYMENT,
        },
        data: orderData,
      });

      if (updateResult.count !== 1) {
        const latestOrder = await tx.order.findUnique({
          where: { id },
          select: {
            status: true,
          },
        });

        if (!latestOrder) {
          throw this.orderNotFoundException();
        }

        this.assertOrderCanTransition(latestOrder.status);
        throw this.orderStatusInvalidException();
      }

      await tx.payment.updateMany({
        where: {
          orderId: id,
          status: PaymentStatus.PENDING,
        },
        data: paymentData,
      });

      return tx.order.findUnique({
        where: { id },
        select: adminOrderDetailSelect,
      });
    });

    if (!order) {
      throw this.orderNotFoundException();
    }

    if (transition === 'cancel') {
      void this.orderEmailService.sendOrderCancelledEmail(order.id);
    } else {
      void this.orderEmailService.sendOrderExpiredEmail(order.id);
    }

    return {
      order: this.toOrderDetail(order),
    };
  }

  private buildOrderWhere(query: AdminOrderQueryDto): Prisma.OrderWhereInput {
    const dateRange = this.parseDateRange(query);
    const where: Prisma.OrderWhereInput = {};
    const search = this.normalizeOptionalQueryText(query.search);

    if (query.status) {
      where.status = query.status;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (dateRange.from || dateRange.to) {
      where.createdAt = this.buildDateTimeFilter(dateRange);
    }

    if (search) {
      where.OR = this.buildSearchWhere(search);
    }

    return where;
  }

  private buildSearchWhere(search: string): Prisma.OrderWhereInput[] {
    const searchWhere: Prisma.OrderWhereInput[] = [
      {
        user: {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      },
    ];
    const orderId = this.parseUuidSearch(search);
    const providerOrderCode = this.parseProviderOrderCodeSearch(search);

    if (orderId) {
      searchWhere.push({ id: orderId });
    }

    if (providerOrderCode !== undefined) {
      searchWhere.push({
        payments: {
          some: {
            providerOrderCode,
          },
        },
      });
    }

    return searchWhere;
  }

  private getOrderBy(
    sort: AdminOrderSort = 'createdAt',
    order: AdminOrderOrder = 'desc',
  ): Prisma.OrderOrderByWithRelationInput[] {
    return [{ [sort]: order }, { id: 'asc' }];
  }

  private parseDateRange(query: AdminOrderQueryDto): DateRange {
    const from = this.parseDateBoundary(query.from, 'from');
    const to = this.parseDateBoundary(query.to, 'to');

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException({
        code: 'ADMIN_ORDER_QUERY_INVALID',
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
        code: 'ADMIN_ORDER_QUERY_INVALID',
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

  private toOrderSummary(order: AdminOrderListRecord) {
    return {
      id: order.id,
      user: order.user,
      status: order.status,
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      voucherId: order.voucherId,
      voucherCodeSnapshot: order.voucherCodeSnapshot,
      voucherNameSnapshot: order.voucherNameSnapshot,
      currency: order.currency,
      shippingRecipientName: order.shippingRecipientName,
      shippingPhone: order.shippingPhone,
      shippingProvince: order.shippingProvince,
      shippingDistrict: order.shippingDistrict,
      shippingWard: order.shippingWard,
      shippingAddressLine: order.shippingAddressLine,
      shippingNote: order.shippingNote,
      itemCount: this.getItemCount(order.items),
      latestPayment: order.payments[0] ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
      expiresAt: order.expiresAt,
    };
  }

  private toOrderDetail(order: AdminOrderDetailRecord) {
    return {
      id: order.id,
      user: order.user,
      status: order.status,
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      voucherId: order.voucherId,
      voucherCodeSnapshot: order.voucherCodeSnapshot,
      voucherNameSnapshot: order.voucherNameSnapshot,
      currency: order.currency,
      shippingRecipientName: order.shippingRecipientName,
      shippingPhone: order.shippingPhone,
      shippingProvince: order.shippingProvince,
      shippingDistrict: order.shippingDistrict,
      shippingWard: order.shippingWard,
      shippingAddressLine: order.shippingAddressLine,
      shippingNote: order.shippingNote,
      itemCount: this.getItemCount(order.items),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
      expiresAt: order.expiresAt,
      items: order.items,
      payments: order.payments,
      webhookEvents: order.webhookEvents,
    };
  }

  private getItemCount(items: Array<{ quantity: number }>): number {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  private assertOrderCanTransition(status: OrderStatus) {
    if (status === OrderStatus.PENDING_PAYMENT) {
      return;
    }

    if (status === OrderStatus.PAID) {
      throw new ConflictException({
        code: 'ADMIN_ORDER_ALREADY_PAID',
        message: 'Paid orders cannot be cancelled or expired by admin action.',
      });
    }

    if (status === OrderStatus.CANCELLED) {
      throw new ConflictException({
        code: 'ADMIN_ORDER_ALREADY_CANCELLED',
        message: 'Order has already been cancelled.',
      });
    }

    if (status === OrderStatus.EXPIRED) {
      throw new ConflictException({
        code: 'ADMIN_ORDER_ALREADY_EXPIRED',
        message: 'Order has already expired.',
      });
    }

    throw this.orderStatusInvalidException();
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

  private orderNotFoundException() {
    return new NotFoundException({
      code: 'ADMIN_ORDER_NOT_FOUND',
      message: 'Order was not found.',
    });
  }

  private orderStatusInvalidException() {
    return new ConflictException({
      code: 'ADMIN_ORDER_STATUS_INVALID',
      message: 'Order status does not allow this admin action.',
    });
  }
}
