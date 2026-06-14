import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  OrderStatus,
  PaymentStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminOrderStatsQueryDto,
  AdminRevenueGroupBy,
  AdminRevenueQueryDto,
  AdminStatsDateRangeQueryDto,
  AdminTopProductsQueryDto,
} from './dto/admin-stats-query.dto';

const DEFAULT_REVENUE_GROUP_BY: AdminRevenueGroupBy = 'day';
const DEFAULT_TOP_PRODUCTS_LIMIT = 10;
const MAX_TOP_PRODUCTS_LIMIT = 50;
const LOW_STOCK_THRESHOLD = 5;
const MAX_REVENUE_BUCKETS = 400;

const ORDER_STATUS_VALUES = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
] as const;

const paidOrderRevenueSelect = {
  id: true,
  totalAmount: true,
  paidAt: true,
  payments: {
    where: {
      status: PaymentStatus.PAID,
    },
    orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    take: 1,
    select: {
      paidAt: true,
    },
  },
} as const satisfies Prisma.OrderSelect;

const paidOrderItemSelect = {
  productId: true,
  variantId: true,
  productName: true,
  quantity: true,
  lineTotal: true,
} as const satisfies Prisma.OrderItemSelect;

type PaidOrderForRevenue = Prisma.OrderGetPayload<{
  select: typeof paidOrderRevenueSelect;
}>;

type PaidOrderItem = Prisma.OrderItemGetPayload<{
  select: typeof paidOrderItemSelect;
}>;

interface DateRange {
  from?: Date;
  to?: Date;
}

interface RevenueBucket {
  paidOrdersCount: number;
  periodEnd: string;
  periodStart: string;
  revenue: number;
}

interface TopProductAggregate {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  variantId: string;
}

@Injectable()
export class AdminStatsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getOverview(query: AdminStatsDateRangeQueryDto) {
    const dateRange = this.parseDateRange(query);
    const paidOrderWhere = this.buildPaidOrderWhere(dateRange);
    const orderCreatedAtWhere = this.buildOrderCreatedAtWhere(dateRange);

    const [
      paidOrdersCount,
      revenueAggregate,
      pendingOrdersCount,
      cancelledOrdersCount,
      expiredOrdersCount,
      totalCustomers,
      totalProducts,
      lowStockVariantsCount,
    ] = await this.prismaService.$transaction([
      this.prismaService.order.count({ where: paidOrderWhere }),
      this.prismaService.order.aggregate({
        where: paidOrderWhere,
        _sum: {
          totalAmount: true,
        },
      }),
      this.prismaService.order.count({
        where: {
          ...orderCreatedAtWhere,
          status: OrderStatus.PENDING_PAYMENT,
        },
      }),
      this.prismaService.order.count({
        where: {
          ...orderCreatedAtWhere,
          status: OrderStatus.CANCELLED,
        },
      }),
      this.prismaService.order.count({
        where: {
          ...orderCreatedAtWhere,
          status: OrderStatus.EXPIRED,
        },
      }),
      this.prismaService.user.count({
        where: {
          role: UserRole.CUSTOMER,
        },
      }),
      this.prismaService.product.count(),
      this.prismaService.productVariant.count({
        where: {
          isActive: true,
          stock: {
            lte: LOW_STOCK_THRESHOLD,
          },
          product: {
            isActive: true,
            category: {
              isActive: true,
            },
          },
        },
      }),
    ]);
    const totalRevenue = revenueAggregate._sum.totalAmount ?? 0;

    return {
      overview: {
        totalRevenue,
        paidOrdersCount,
        pendingOrdersCount,
        cancelledOrdersCount,
        expiredOrdersCount,
        averagePaidOrderValue:
          paidOrdersCount === 0
            ? 0
            : Math.round((totalRevenue / paidOrdersCount) * 100) / 100,
        totalCustomers,
        totalProducts,
        lowStockVariantsCount,
        filters: this.toFilterResponse(dateRange),
      },
    };
  }

  async getRevenue(query: AdminRevenueQueryDto) {
    const dateRange = this.parseDateRange(query);
    const groupBy = query.groupBy ?? DEFAULT_REVENUE_GROUP_BY;
    const orders = await this.prismaService.order.findMany({
      where: this.buildPaidOrderWhere(dateRange),
      select: paidOrderRevenueSelect,
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    });
    const buckets = this.buildRevenueBuckets(orders, groupBy, dateRange);

    return {
      revenue: {
        groupBy,
        totalRevenue: buckets.reduce((total, bucket) => total + bucket.revenue, 0),
        paidOrdersCount: buckets.reduce(
          (total, bucket) => total + bucket.paidOrdersCount,
          0,
        ),
        buckets,
        filters: this.toFilterResponse(dateRange),
      },
    };
  }

  async getTopProducts(query: AdminTopProductsQueryDto) {
    const dateRange = this.parseDateRange(query);
    const limit = Math.min(
      query.limit ?? DEFAULT_TOP_PRODUCTS_LIMIT,
      MAX_TOP_PRODUCTS_LIMIT,
    );
    const items = await this.prismaService.orderItem.findMany({
      where: {
        order: this.buildPaidOrderWhere(dateRange),
      },
      select: paidOrderItemSelect,
    });
    const topProducts = this.aggregateTopProducts(items).slice(0, limit);

    return {
      topProducts,
      limit,
      filters: this.toFilterResponse(dateRange),
    };
  }

  async getOrderStats(query: AdminOrderStatsQueryDto) {
    const dateRange = this.parseDateRange(query);
    const where: Prisma.OrderWhereInput = {
      ...this.buildOrderCreatedAtWhere(dateRange),
      ...(query.status ? { status: query.status } : {}),
    };
    const groupedCounts = await this.prismaService.order.groupBy({
      by: ['status'],
      where,
      _count: {
        _all: true,
      },
    });
    const byStatus = ORDER_STATUS_VALUES.reduce(
      (counts, status) => ({
        ...counts,
        [status]: 0,
      }),
      {} as Record<OrderStatus, number>,
    );

    for (const group of groupedCounts) {
      byStatus[group.status] = group._count._all;
    }

    return {
      orders: {
        total: Object.values(byStatus).reduce((total, count) => total + count, 0),
        byStatus,
        counts: ORDER_STATUS_VALUES.map((status) => ({
          status,
          count: byStatus[status],
        })),
        filters: {
          ...this.toFilterResponse(dateRange),
          status: query.status ?? null,
        },
      },
    };
  }

  private aggregateTopProducts(items: PaidOrderItem[]): TopProductAggregate[] {
    const productsByVariant = new Map<string, TopProductAggregate>();

    for (const item of items) {
      const key = `${item.productId}:${item.variantId}`;
      const existing = productsByVariant.get(key);

      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += item.lineTotal;
        continue;
      }

      productsByVariant.set(key, {
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        quantitySold: item.quantity,
        revenue: item.lineTotal,
      });
    }

    return [...productsByVariant.values()].sort(
      (first, second) =>
        second.revenue - first.revenue ||
        second.quantitySold - first.quantitySold ||
        first.productName.localeCompare(second.productName),
    );
  }

  private buildPaidOrderWhere(dateRange: DateRange): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      status: OrderStatus.PAID,
      payments: {
        some: {
          status: PaymentStatus.PAID,
        },
      },
    };

    if (!dateRange.from && !dateRange.to) {
      return where;
    }

    const paidAtFilter = this.buildNullableDateTimeFilter(dateRange);

    return {
      ...where,
      OR: [
        {
          paidAt: {
            ...paidAtFilter,
            not: null,
          },
        },
        {
          paidAt: null,
          payments: {
            some: {
              status: PaymentStatus.PAID,
              paidAt: paidAtFilter,
            },
          },
        },
      ],
    };
  }

  private buildOrderCreatedAtWhere(dateRange: DateRange): Prisma.OrderWhereInput {
    if (!dateRange.from && !dateRange.to) {
      return {};
    }

    return {
      createdAt: this.buildDateTimeFilter(dateRange),
    };
  }

  private buildRevenueBuckets(
    orders: PaidOrderForRevenue[],
    groupBy: AdminRevenueGroupBy,
    dateRange: DateRange,
  ): RevenueBucket[] {
    const bucketsByStart = new Map<string, RevenueBucket>();

    if (dateRange.from && dateRange.to) {
      this.seedRevenueBuckets(bucketsByStart, groupBy, dateRange);
    }

    for (const order of orders) {
      const paidAt = this.getPaidDate(order);

      if (!paidAt || !this.isWithinDateRange(paidAt, dateRange)) {
        continue;
      }

      const periodStart = this.getBucketStart(paidAt, groupBy);
      const key = periodStart.toISOString();
      const bucket =
        bucketsByStart.get(key) ?? this.createRevenueBucket(periodStart, groupBy);

      bucket.revenue += order.totalAmount;
      bucket.paidOrdersCount += 1;
      bucketsByStart.set(key, bucket);
    }

    return [...bucketsByStart.values()].sort((first, second) =>
      first.periodStart.localeCompare(second.periodStart),
    );
  }

  private seedRevenueBuckets(
    bucketsByStart: Map<string, RevenueBucket>,
    groupBy: AdminRevenueGroupBy,
    dateRange: DateRange,
  ) {
    if (!dateRange.from || !dateRange.to) {
      return;
    }

    let current = this.getBucketStart(dateRange.from, groupBy);
    const end = this.getBucketStart(dateRange.to, groupBy);
    let bucketCount = 0;

    while (current.getTime() <= end.getTime()) {
      if (bucketCount >= MAX_REVENUE_BUCKETS) {
        throw new BadRequestException({
          code: 'STATS_DATE_RANGE_TOO_LARGE',
          message: 'Date range is too large for the requested revenue grouping.',
        });
      }

      bucketsByStart.set(
        current.toISOString(),
        this.createRevenueBucket(current, groupBy),
      );
      current = this.getNextBucketStart(current, groupBy);
      bucketCount += 1;
    }
  }

  private createRevenueBucket(
    periodStart: Date,
    groupBy: AdminRevenueGroupBy,
  ): RevenueBucket {
    const nextPeriodStart = this.getNextBucketStart(periodStart, groupBy);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: new Date(nextPeriodStart.getTime() - 1).toISOString(),
      revenue: 0,
      paidOrdersCount: 0,
    };
  }

  private getPaidDate(order: PaidOrderForRevenue): Date | null {
    return order.paidAt ?? order.payments[0]?.paidAt ?? null;
  }

  private getBucketStart(date: Date, groupBy: AdminRevenueGroupBy): Date {
    if (groupBy === 'month') {
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    }

    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );

    if (groupBy === 'week') {
      const weekday = start.getUTCDay() === 0 ? 7 : start.getUTCDay();

      start.setUTCDate(start.getUTCDate() - weekday + 1);
    }

    return start;
  }

  private getNextBucketStart(
    periodStart: Date,
    groupBy: AdminRevenueGroupBy,
  ): Date {
    if (groupBy === 'month') {
      return new Date(
        Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
      );
    }

    const next = new Date(periodStart);

    next.setUTCDate(next.getUTCDate() + (groupBy === 'week' ? 7 : 1));
    return next;
  }

  private parseDateRange(query: AdminStatsDateRangeQueryDto): DateRange {
    const from = this.parseDateBoundary(query.from, 'from');
    const to = this.parseDateBoundary(query.to, 'to');

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException({
        code: 'STATS_DATE_RANGE_INVALID',
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
        code: 'STATS_DATE_RANGE_INVALID',
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

  private buildNullableDateTimeFilter(
    dateRange: DateRange,
  ): Prisma.DateTimeNullableFilter {
    const filter: Prisma.DateTimeNullableFilter = {};

    if (dateRange.from) {
      filter.gte = dateRange.from;
    }

    if (dateRange.to) {
      filter.lte = dateRange.to;
    }

    return filter;
  }

  private isWithinDateRange(date: Date, dateRange: DateRange): boolean {
    return (
      (!dateRange.from || date.getTime() >= dateRange.from.getTime()) &&
      (!dateRange.to || date.getTime() <= dateRange.to.getTime())
    );
  }

  private toFilterResponse(dateRange: DateRange) {
    return {
      from: dateRange.from?.toISOString() ?? null,
      to: dateRange.to?.toISOString() ?? null,
    };
  }
}
