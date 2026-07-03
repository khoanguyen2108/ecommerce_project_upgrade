import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Prisma } from '../generated/prisma/client';
import {
  OrderFulfillmentStatus,
  OrderStatus,
  ReturnRequestStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminReturnQueryDto } from './dto/admin-return-query.dto';
import type { CreateReturnRequestDto } from './dto/create-return-request.dto';
import type { ReviewReturnRequestDto } from './dto/review-return-request.dto';

const DEFAULT_RETURN_LIMIT = 20;
const MAX_RETURN_LIMIT = 100;

const customerReturnSelect = {
  orderId: true,
  reason: true,
  description: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
  order: {
    select: {
      orderCode: true,
      fulfilledAt: true,
    },
  },
} as const satisfies Prisma.ReturnRequestSelect;

const adminReturnListSelect = {
  id: true,
  reason: true,
  status: true,
  createdAt: true,
  order: {
    select: {
      orderCode: true,
    },
  },
  customer: {
    select: {
      email: true,
      name: true,
    },
  },
} as const satisfies Prisma.ReturnRequestSelect;

const adminReturnDetailSelect = {
  id: true,
  reason: true,
  description: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
  order: {
    select: {
      orderCode: true,
      status: true,
      fulfillmentStatus: true,
      fulfilledAt: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
    },
  },
  customer: {
    select: {
      email: true,
      name: true,
    },
  },
  reviewer: {
    select: {
      email: true,
      name: true,
    },
  },
} as const satisfies Prisma.ReturnRequestSelect;

type CustomerReturnRecord = Prisma.ReturnRequestGetPayload<{
  select: typeof customerReturnSelect;
}>;
type AdminReturnListRecord = Prisma.ReturnRequestGetPayload<{
  select: typeof adminReturnListSelect;
}>;
type AdminReturnDetailRecord = Prisma.ReturnRequestGetPayload<{
  select: typeof adminReturnDetailSelect;
}>;

export interface EligibleReturnOrder {
  orderCode: string;
  deliveredAt: string;
  status: 'DELIVERED';
}

export type ReturnEligibilityResult =
  | { eligible: true; order: EligibleReturnOrder }
  | {
      eligible: false;
      reason: 'NO_DELIVERED_ORDER' | 'ORDER_NOT_DELIVERED' | 'PENDING_REQUEST_EXISTS';
    };

@Injectable()
export class ReturnsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createReturnRequest(
    customer: AuthenticatedUser,
    dto: CreateReturnRequestDto,
  ) {
    try {
      const request = await this.prismaService.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            orderCode: dto.orderCode,
            userId: customer.id,
          },
          select: {
            id: true,
            fulfillmentStatus: true,
            status: true,
          },
        });

        if (!order) {
          throw this.customerOrderNotFoundException();
        }

        this.assertDeliveredOrder(order);

        const pendingRequest = await tx.returnRequest.findFirst({
          where: {
            orderId: order.id,
            status: ReturnRequestStatus.PENDING,
          },
          select: { id: true },
        });

        if (pendingRequest) {
          throw this.pendingRequestException();
        }

        return tx.returnRequest.create({
          data: {
            customerId: customer.id,
            description: dto.description ?? null,
            orderId: order.id,
            reason: dto.reason,
          },
          select: customerReturnSelect,
        });
      });

      return { returnRequest: this.toCustomerReturn(request) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.pendingRequestException();
      }

      throw error;
    }
  }

  async listMyReturnRequests(customerId: string) {
    const requests = await this.prismaService.returnRequest.findMany({
      where: { customerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: customerReturnSelect,
    });

    return {
      returnRequests: requests.map((request) => this.toCustomerReturn(request)),
    };
  }

  async listAdminReturns(query: AdminReturnQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? DEFAULT_RETURN_LIMIT, MAX_RETURN_LIMIT);
    const where: Prisma.ReturnRequestWhereInput = query.status
      ? { status: query.status }
      : {};
    const [total, requests] = await this.prismaService.$transaction([
      this.prismaService.returnRequest.count({ where }),
      this.prismaService.returnRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: adminReturnListSelect,
      }),
    ]);

    return {
      returnRequests: requests.map((request) => this.toAdminReturnList(request)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getAdminReturn(id: string) {
    const request = await this.prismaService.returnRequest.findUnique({
      where: { id },
      select: adminReturnDetailSelect,
    });

    if (!request) {
      throw this.returnRequestNotFoundException();
    }

    return { returnRequest: this.toAdminReturnDetail(request) };
  }

  async reviewReturnRequest(
    id: string,
    dto: ReviewReturnRequestDto,
    adminId: string,
  ) {
    const reviewedAt = new Date();
    const request = await this.prismaService.$transaction(async (tx) => {
      const update = await tx.returnRequest.updateMany({
        where: {
          id,
          status: ReturnRequestStatus.PENDING,
        },
        data: {
          reviewedAt,
          reviewedBy: adminId,
          status: dto.status,
        },
      });

      if (update.count !== 1) {
        const existing = await tx.returnRequest.findUnique({
          where: { id },
          select: { status: true },
        });

        if (!existing) {
          throw this.returnRequestNotFoundException();
        }

        throw new ConflictException({
          code: 'RETURN_REQUEST_ALREADY_REVIEWED',
          message: 'Return request has already been reviewed.',
        });
      }

      if (dto.status === ReturnRequestStatus.APPROVED) {
        const approvedRequest = await tx.returnRequest.findUnique({
          where: { id },
          select: { orderId: true },
        });

        if (!approvedRequest) {
          throw this.returnRequestNotFoundException();
        }

        await tx.order.update({
          where: { id: approvedRequest.orderId },
          data: {
            fulfillmentStatus: OrderFulfillmentStatus.RETURNED,
          },
        });
      }

      return tx.returnRequest.findUnique({
        where: { id },
        select: adminReturnDetailSelect,
      });
    });

    if (!request) {
      throw this.returnRequestNotFoundException();
    }

    return { returnRequest: this.toAdminReturnDetail(request) };
  }

  async getReturnEligibilityForCustomer(
    customerId: string,
    orderId?: string,
  ): Promise<ReturnEligibilityResult> {
    if (orderId) {
      const order = await this.prismaService.order.findFirst({
        where: { id: orderId, userId: customerId },
        select: {
          orderCode: true,
          status: true,
          fulfillmentStatus: true,
          fulfilledAt: true,
          returnRequests: {
            where: { status: ReturnRequestStatus.PENDING },
            take: 1,
            select: { id: true },
          },
        },
      });

      if (!order) {
        throw this.customerOrderNotFoundException();
      }

      if (!this.isDeliveredOrder(order)) {
        return { eligible: false, reason: 'ORDER_NOT_DELIVERED' };
      }

      if (order.returnRequests.length > 0) {
        return { eligible: false, reason: 'PENDING_REQUEST_EXISTS' };
      }

      return { eligible: true, order: this.toEligibleReturnOrder(order) };
    }

    const eligibleOrder = await this.prismaService.order.findFirst({
      where: {
        userId: customerId,
        status: OrderStatus.PAID,
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED,
        fulfilledAt: { not: null },
        returnRequests: {
          none: { status: ReturnRequestStatus.PENDING },
        },
      },
      orderBy: [{ fulfilledAt: 'desc' }, { id: 'asc' }],
      select: {
        orderCode: true,
        status: true,
        fulfillmentStatus: true,
        fulfilledAt: true,
      },
    });

    if (eligibleOrder) {
      return {
        eligible: true,
        order: this.toEligibleReturnOrder(eligibleOrder),
      };
    }

    const pendingDeliveredOrder = await this.prismaService.order.findFirst({
      where: {
        userId: customerId,
        status: OrderStatus.PAID,
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED,
        returnRequests: {
          some: { status: ReturnRequestStatus.PENDING },
        },
      },
      select: { id: true },
    });

    return pendingDeliveredOrder
      ? { eligible: false, reason: 'PENDING_REQUEST_EXISTS' }
      : { eligible: false, reason: 'NO_DELIVERED_ORDER' };
  }

  private toCustomerReturn(request: CustomerReturnRecord) {
    return {
      orderCode: request.order.orderCode,
      deliveredAt: request.order.fulfilledAt,
      reason: request.reason,
      description: request.description,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
    };
  }

  private toAdminReturnList(request: AdminReturnListRecord) {
    return {
      id: request.id,
      orderCode: request.order.orderCode,
      customer: request.customer,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  private toAdminReturnDetail(request: AdminReturnDetailRecord) {
    return {
      id: request.id,
      order: request.order,
      customer: request.customer,
      reason: request.reason,
      description: request.description,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      reviewer: request.reviewer,
    };
  }

  private isDeliveredOrder(order: {
    fulfillmentStatus: OrderFulfillmentStatus;
    status: OrderStatus;
  }): boolean {
    return (
      order.status === OrderStatus.PAID &&
      order.fulfillmentStatus === OrderFulfillmentStatus.DELIVERED
    );
  }

  private assertDeliveredOrder(order: {
    fulfillmentStatus: OrderFulfillmentStatus;
    status: OrderStatus;
  }) {
    if (!this.isDeliveredOrder(order)) {
      throw new ConflictException({
        code: 'RETURN_ORDER_NOT_DELIVERED',
        message: 'A return can be requested only after the order is delivered.',
      });
    }
  }

  private toEligibleReturnOrder(order: {
    orderCode: string;
    fulfilledAt: Date | null;
  }): EligibleReturnOrder {
    if (!order.fulfilledAt) {
      throw new ConflictException({
        code: 'RETURN_ORDER_NOT_DELIVERED',
        message: 'A return can be requested only after the order is delivered.',
      });
    }

    return {
      orderCode: order.orderCode,
      deliveredAt: order.fulfilledAt.toISOString(),
      status: 'DELIVERED',
    };
  }

  private customerOrderNotFoundException() {
    return new NotFoundException({
      code: 'RETURN_ORDER_NOT_FOUND',
      message: 'Order was not found.',
    });
  }

  private pendingRequestException() {
    return new ConflictException({
      code: 'RETURN_REQUEST_PENDING_EXISTS',
      message: 'A return request for this order is already pending review.',
    });
  }

  private returnRequestNotFoundException() {
    return new NotFoundException({
      code: 'RETURN_REQUEST_NOT_FOUND',
      message: 'Return request was not found.',
    });
  }
}
