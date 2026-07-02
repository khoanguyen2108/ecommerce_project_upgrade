import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { OrderEmailService } from '../email/order-email.service';
import { Prisma } from '../generated/prisma/client';
import {
  OrderFulfillmentStatus,
  OrderStatus,
  PaymentReconciliationIssueStatus,
  UserRole,
} from '../generated/prisma/enums';
import { OrderExpiryService } from '../order-expiry/order-expiry.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { OrderQueryDto } from './dto/order-query.dto';
import { getFirstProductImage } from './order-item-image';

const DEFAULT_ORDER_LIMIT = 20;
const MAX_ORDER_LIMIT = 50;
const MAX_ORDER_TOTAL = 2_000_000_000;
const DEFAULT_CURRENCY = 'VND';
const ORDER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ORDER_CODE_PATTERN = /^BK\d{6,}$/;

export type ActiveOrderCardStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY';

export interface ActiveOrderCardProjection {
  orderCode: string;
  status: ActiveOrderCardStatus;
  createdAt: string;
  estimatedArrival: string | null;
  totalAmount: number;
  currency: string;
  thumbnail: string | null;
  detailUrl: string;
}

export interface CustomerOrderSupportSummary {
  orderId: string;
  status: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  updatedAt: string;
}

const paymentSummarySelect = {
  id: true,
  orderId: true,
  provider: true,
  status: true,
  amount: true,
  currency: true,
  providerOrderCode: true,
  checkoutUrl: true,
  providerPaymentLinkId: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
} as const satisfies Prisma.PaymentSelect;

const orderItemSelect = {
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
  product: {
    select: {
      imageUrls: true,
    },
  },
} as const satisfies Prisma.OrderItemSelect;

const orderSelect = {
  id: true,
  orderCode: true,
  userId: true,
  status: true,
  fulfillmentStatus: true,
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
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  fulfilledAt: true,
  cancelledAt: true,
  expiresAt: true,
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    select: orderItemSelect,
  },
  payments: {
    orderBy: {
      createdAt: 'desc',
    },
    select: paymentSummarySelect,
  },
} as const satisfies Prisma.OrderSelect;

type OrderRecord = Prisma.OrderGetPayload<{
  select: typeof orderSelect;
}>;

const activeOrderCardSelect = {
  id: true,
  orderCode: true,
  status: true,
  fulfillmentStatus: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    take: 1,
    select: {
      product: {
        select: {
          imageUrls: true,
        },
      },
    },
  },
} as const satisfies Prisma.OrderSelect;

type ActiveOrderCardRecord = Prisma.OrderGetPayload<{
  select: typeof activeOrderCardSelect;
}>;

const customerOrderSupportSelect = {
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

const variantSnapshotSelect = {
  id: true,
  productId: true,
  sku: true,
  size: true,
  color: true,
  stock: true,
  priceOverride: true,
  isActive: true,
  product: {
    select: {
      id: true,
      name: true,
      basePrice: true,
      isActive: true,
      category: {
        select: {
          isActive: true,
        },
      },
    },
  },
} as const satisfies Prisma.ProductVariantSelect;

type VariantSnapshot = Prisma.ProductVariantGetPayload<{
  select: typeof variantSnapshotSelect;
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderEmailService: OrderEmailService,
    private readonly orderExpiryService: OrderExpiryService,
    private readonly prismaService: PrismaService,
  ) {}

  async createOrder(user: AuthenticatedUser, dto: CreateOrderDto) {
    const itemIntents = this.mergeItemIntents(dto.items);

    const order = await this.prismaService.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: {
          id: {
            in: [...itemIntents.keys()],
          },
        },
        select: variantSnapshotSelect,
      });
      const variantsById = new Map(
        variants.map((variant) => [variant.id, variant]),
      );
      const items = [...itemIntents.entries()].map(([variantId, quantity]) => {
        const variant = variantsById.get(variantId);

        if (!variant || !this.isVariantOrderable(variant)) {
          throw this.orderItemUnavailableException();
        }

        if (variant.stock <= 0 || quantity > variant.stock) {
          throw new BadRequestException({
            code: 'ORDER_ITEM_STOCK_UNAVAILABLE',
            message: 'Requested quantity is not available for one or more items.',
          });
        }

        const unitPrice = variant.priceOverride ?? variant.product.basePrice;
        const lineTotal = unitPrice * quantity;

        return {
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          unitPrice,
          quantity,
          lineTotal,
        };
      });
      const subtotalAmount = items.reduce(
        (total, item) => total + item.lineTotal,
        0,
      );

      if (
        !Number.isSafeInteger(subtotalAmount) ||
        subtotalAmount <= 0 ||
        subtotalAmount > MAX_ORDER_TOTAL
      ) {
        throw new BadRequestException({
          code: 'ORDER_TOTAL_INVALID',
          message: 'Order total is invalid.',
        });
      }

      return tx.order.create({
        data: {
          userId: user.id,
          status: OrderStatus.PENDING_PAYMENT,
          subtotalAmount,
          totalAmount: subtotalAmount,
          currency: DEFAULT_CURRENCY,
          expiresAt: this.orderExpiryService.getPendingOrderExpiresAt(),
          items: {
            create: items,
          },
        },
        select: orderSelect,
      });
    });

    void this.orderEmailService.sendOrderCreatedEmail(order.id);

    return { order: this.toOrderResponse(order) };
  }

  async listOrders(user: AuthenticatedUser, query: OrderQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? DEFAULT_ORDER_LIMIT, MAX_ORDER_LIMIT);
    const where = this.buildOrderWhere(user, query);

    const [total, orders] = await this.prismaService.$transaction([
      this.prismaService.order.count({ where }),
      this.prismaService.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: orderSelect,
      }),
    ]);

    return {
      orders: orders.map((order) => this.toOrderResponse(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getOrder(user: AuthenticatedUser, identifier: string) {
    const identifierWhere = this.buildOrderIdentifierWhere(identifier);
    const order = await this.prismaService.order.findFirst({
      where: {
        ...identifierWhere,
        ...(user.role === UserRole.ADMIN ? {} : { userId: user.id }),
      },
      select: orderSelect,
    });

    if (!order) {
      throw this.orderNotFoundException();
    }

    return { order: this.toOrderResponse(order) };
  }

  async getActiveOrdersForCustomer(
    userId: string,
  ): Promise<ActiveOrderCardProjection[]> {
    const orders = await this.prismaService.order.findMany({
      where: {
        userId,
        status: {
          in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID],
        },
        fulfillmentStatus: {
          not: OrderFulfillmentStatus.DELIVERED,
        },
        fulfilledAt: null,
        paymentReconciliationIssues: {
          none: {
            status: PaymentReconciliationIssueStatus.REFUNDED,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: activeOrderCardSelect,
    });

    return orders.map((order) => this.toActiveOrderCard(order));
  }

  async getCustomerOrderSupportSummary(
    userId: string,
    orderId: string,
  ): Promise<CustomerOrderSupportSummary> {
    const order = await this.prismaService.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: customerOrderSupportSelect,
    });

    if (!order) {
      throw this.orderNotFoundException();
    }

    return {
      orderId: order.id,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.payments[0]?.status ?? 'NOT_AVAILABLE',
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private toOrderResponse(order: OrderRecord) {
    return {
      ...order,
      items: order.items.map(({ product, ...item }) => ({
        ...item,
        imageUrl: getFirstProductImage(product),
      })),
    };
  }

  private toActiveOrderCard(
    order: ActiveOrderCardRecord,
  ): ActiveOrderCardProjection {
    return {
      orderCode: order.orderCode,
      status: this.getActiveOrderCardStatus(order),
      createdAt: order.createdAt.toISOString(),
      estimatedArrival: null,
      totalAmount: order.totalAmount,
      currency: order.currency,
      thumbnail: getFirstProductImage(order.items[0]?.product),
      detailUrl: `/orders/${encodeURIComponent(order.orderCode)}`,
    };
  }

  private getActiveOrderCardStatus(
    order: Pick<ActiveOrderCardRecord, 'status' | 'fulfillmentStatus'>,
  ): ActiveOrderCardStatus {
    if (order.status === OrderStatus.PENDING_PAYMENT) {
      return 'PENDING_PAYMENT';
    }

    if (order.fulfillmentStatus === OrderFulfillmentStatus.PENDING) {
      return 'PAID';
    }

    switch (order.fulfillmentStatus) {
      case OrderFulfillmentStatus.PICKED_UP:
        return 'PICKED_UP';
      case OrderFulfillmentStatus.IN_TRANSIT:
        return 'IN_TRANSIT';
      case OrderFulfillmentStatus.OUT_FOR_DELIVERY:
        return 'OUT_FOR_DELIVERY';
      default:
        return 'PAID';
    }
  }

  private buildOrderWhere(
    user: AuthenticatedUser,
    query: OrderQueryDto & { id?: string },
  ): Prisma.OrderWhereInput {
    return {
      ...(query.id ? { id: query.id } : {}),
      ...(user.role === UserRole.ADMIN ? {} : { userId: user.id }),
      ...(query.status ? { status: query.status } : {}),
    };
  }

  private buildOrderIdentifierWhere(
    identifier: string,
  ): Pick<Prisma.OrderWhereInput, 'id' | 'orderCode'> {
    if (ORDER_UUID_PATTERN.test(identifier)) {
      return { id: identifier };
    }

    if (PUBLIC_ORDER_CODE_PATTERN.test(identifier)) {
      return { orderCode: identifier };
    }

    throw this.orderNotFoundException();
  }

  private mergeItemIntents(
    items: CreateOrderDto['items'],
  ): Map<string, number> {
    const itemIntents = new Map<string, number>();

    for (const item of items) {
      const currentQuantity = itemIntents.get(item.variantId) ?? 0;
      const nextQuantity = currentQuantity + item.quantity;

      if (nextQuantity > 99) {
        throw new BadRequestException({
          code: 'ORDER_ITEM_QUANTITY_INVALID',
          message: 'Item quantity is too large.',
        });
      }

      itemIntents.set(item.variantId, nextQuantity);
    }

    return itemIntents;
  }

  private isVariantOrderable(variant: VariantSnapshot): boolean {
    return (
      variant.isActive &&
      variant.product.isActive &&
      variant.product.category.isActive
    );
  }

  private orderItemUnavailableException() {
    return new BadRequestException({
      code: 'ORDER_ITEM_UNAVAILABLE',
      message: 'One or more order items are not available.',
    });
  }

  private orderNotFoundException() {
    return new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: 'Order was not found.',
    });
  }
}
