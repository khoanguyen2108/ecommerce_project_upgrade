import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  OrderStatus,
  VoucherDiscountType,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

const eligibleVoucherSelect = {
  id: true,
  code: true,
  name: true,
  discountType: true,
  discountValue: true,
  maxDiscount: true,
  minSubtotal: true,
  usageLimit: true,
  perUserLimit: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
} satisfies Prisma.VoucherSelect;

type VoucherRecord = Prisma.VoucherGetPayload<{
  select: typeof eligibleVoucherSelect;
}>;

type VoucherClient = Pick<
  Prisma.TransactionClient,
  'voucher' | 'order' | '$queryRaw'
>;

export interface AppliedVoucherSnapshot {
  code: string;
  name: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minSubtotal: number;
}

export interface VoucherErrorResponse {
  code: string;
  message: string;
}

export type VoucherEvaluation =
  | {
      eligible: true;
      voucher: VoucherRecord;
      appliedVoucher: AppliedVoucherSnapshot;
      discountAmount: number;
      totalAmount: number;
    }
  | {
      eligible: false;
      error: VoucherErrorResponse;
      discountAmount: 0;
      totalAmount: number;
    };

@Injectable()
export class VoucherEligibilityService {
  constructor(private readonly prismaService: PrismaService) {}

  evaluateForSummary(
    userId: string | undefined,
    subtotalAmount: number,
    voucherCode: string,
    now = new Date(),
  ) {
    return this.evaluate(
      this.prismaService,
      userId,
      subtotalAmount,
      voucherCode,
      now,
      false,
    );
  }

  async requireForOrder(
    tx: Prisma.TransactionClient,
    userId: string | undefined,
    subtotalAmount: number,
    voucherCode: string,
    now = new Date(),
  ) {
    const result = await this.evaluate(
      tx,
      userId,
      subtotalAmount,
      voucherCode,
      now,
      true,
    );

    if (!result.eligible) {
      throw new BadRequestException(result.error);
    }

    return result;
  }

  async listEligible(
    userId: string | undefined,
    subtotalAmount: number,
    now = new Date(),
  ): Promise<AppliedVoucherSnapshot[]> {
    const candidates = await this.prismaService.voucher.findMany({
      where: {
        isActive: true,
        minSubtotal: { lte: subtotalAmount },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ minSubtotal: 'asc' }, { code: 'asc' }],
      take: 20,
      select: eligibleVoucherSelect,
    });

    const evaluations = await Promise.all(
      candidates.map((voucher) =>
        this.evaluateRecord(
          this.prismaService,
          userId,
          subtotalAmount,
          voucher,
          now,
        ),
      ),
    );

    return evaluations
      .filter((result): result is Extract<VoucherEvaluation, { eligible: true }> =>
        result.eligible,
      )
      .map((result) => result.appliedVoucher);
  }

  private async evaluate(
    client: VoucherClient,
    userId: string | undefined,
    subtotalAmount: number,
    voucherCode: string,
    now: Date,
    lockVoucher: boolean,
  ): Promise<VoucherEvaluation> {
    const normalizedCode = voucherCode.trim().toUpperCase();
    const voucher = await client.voucher.findFirst({
      where: {
        code: { equals: normalizedCode, mode: 'insensitive' },
      },
      select: eligibleVoucherSelect,
    });

    if (!voucher) {
      return this.ineligible(
        'CHECKOUT_VOUCHER_NOT_FOUND',
        'Voucher code was not found.',
        subtotalAmount,
      );
    }

    let currentVoucher = voucher;
    if (lockVoucher) {
      await client.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Voucher" WHERE "id" = ${voucher.id}::uuid FOR UPDATE
      `;
      const lockedVoucher = await client.voucher.findUnique({
        where: { id: voucher.id },
        select: eligibleVoucherSelect,
      });
      if (!lockedVoucher) {
        return this.ineligible(
          'CHECKOUT_VOUCHER_NOT_FOUND',
          'Voucher code was not found.',
          subtotalAmount,
        );
      }
      currentVoucher = lockedVoucher;
    }

    return this.evaluateRecord(
      client,
      userId,
      subtotalAmount,
      currentVoucher,
      now,
    );
  }

  private async evaluateRecord(
    client: VoucherClient,
    userId: string | undefined,
    subtotalAmount: number,
    voucher: VoucherRecord,
    now: Date,
  ): Promise<VoucherEvaluation> {
    if (!voucher.isActive) {
      return this.ineligible(
        'CHECKOUT_VOUCHER_INACTIVE',
        'Voucher is inactive.',
        subtotalAmount,
      );
    }
    if (voucher.startsAt && voucher.startsAt > now) {
      return this.ineligible(
        'CHECKOUT_VOUCHER_NOT_STARTED',
        'Voucher is not active yet.',
        subtotalAmount,
      );
    }
    if (voucher.endsAt && voucher.endsAt < now) {
      return this.ineligible(
        'CHECKOUT_VOUCHER_EXPIRED',
        'Voucher has expired.',
        subtotalAmount,
      );
    }
    if (subtotalAmount < voucher.minSubtotal) {
      return this.ineligible(
        'CHECKOUT_VOUCHER_MIN_SUBTOTAL',
        `A minimum subtotal of ${voucher.minSubtotal} VND is required.`,
        subtotalAmount,
      );
    }
    if (
      voucher.discountValue <= 0 ||
      (voucher.discountType === VoucherDiscountType.PERCENT &&
        voucher.discountValue > 100) ||
      (voucher.maxDiscount !== null && voucher.maxDiscount <= 0)
    ) {
      return this.ineligible(
        'CHECKOUT_VOUCHER_DISCOUNT_INVALID',
        'Voucher discount configuration is invalid.',
        subtotalAmount,
      );
    }

    const reservedOrderWhere: Prisma.OrderWhereInput = {
      voucherId: voucher.id,
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED] },
    };
    if (voucher.usageLimit !== null) {
      const usageCount = await client.order.count({ where: reservedOrderWhere });
      if (usageCount >= voucher.usageLimit) {
        return this.ineligible(
          'CHECKOUT_VOUCHER_USAGE_LIMIT_REACHED',
          'Voucher usage limit has been reached.',
          subtotalAmount,
        );
      }
    }
    if (voucher.perUserLimit !== null && userId) {
      const userUsageCount = await client.order.count({
        where: { ...reservedOrderWhere, userId },
      });
      if (userUsageCount >= voucher.perUserLimit) {
        return this.ineligible(
          'CHECKOUT_VOUCHER_PER_USER_LIMIT_REACHED',
          'Your usage limit for this voucher has been reached.',
          subtotalAmount,
        );
      }
    }

    const rawDiscount =
      voucher.discountType === VoucherDiscountType.FIXED
        ? voucher.discountValue
        : Math.floor((subtotalAmount * voucher.discountValue) / 100);
    const cappedDiscount =
      voucher.maxDiscount === null
        ? rawDiscount
        : Math.min(rawDiscount, voucher.maxDiscount);
    const discountAmount = Math.min(cappedDiscount, subtotalAmount);

    if (!Number.isSafeInteger(discountAmount) || discountAmount <= 0) {
      return this.ineligible(
        'CHECKOUT_VOUCHER_DISCOUNT_INVALID',
        'Voucher discount does not produce a valid amount.',
        subtotalAmount,
      );
    }

    return {
      eligible: true,
      voucher,
      appliedVoucher: this.toAppliedVoucher(voucher),
      discountAmount,
      totalAmount: Math.max(0, subtotalAmount - discountAmount),
    };
  }

  private toAppliedVoucher(voucher: VoucherRecord): AppliedVoucherSnapshot {
    return {
      code: voucher.code,
      name: voucher.name,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      maxDiscount: voucher.maxDiscount,
      minSubtotal: voucher.minSubtotal,
    };
  }

  private ineligible(
    code: string,
    message: string,
    subtotalAmount: number,
  ): VoucherEvaluation {
    return {
      eligible: false,
      error: { code, message },
      discountAmount: 0,
      totalAmount: subtotalAmount,
    };
  }
}
