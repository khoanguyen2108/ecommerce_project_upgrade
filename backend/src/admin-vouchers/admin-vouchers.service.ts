import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { VoucherDiscountType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminVoucherQueryDto } from './dto/admin-voucher-query.dto';
import type { CreateVoucherDto } from './dto/create-voucher.dto';
import type { UpdateVoucherDto } from './dto/update-voucher.dto';

const DEFAULT_VOUCHER_LIMIT = 8;
const MAX_VOUCHER_LIMIT = 100;

const voucherSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  discountType: true,
  discountValue: true,
  minSubtotal: true,
  maxDiscount: true,
  usageLimit: true,
  perUserLimit: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VoucherSelect;

interface VoucherRuleState {
  discountType: VoucherDiscountType;
  discountValue: number;
  minSubtotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

@Injectable()
export class AdminVouchersService {
  constructor(private readonly prismaService: PrismaService) {}

  async listVouchers(query: AdminVoucherQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? DEFAULT_VOUCHER_LIMIT, MAX_VOUCHER_LIMIT);
    const search = query.search?.trim();
    const where: Prisma.VoucherWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, vouchers] = await this.prismaService.$transaction([
      this.prismaService.voucher.count({ where }),
      this.prismaService.voucher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { code: 'asc' }],
        select: voucherSelect,
      }),
    ]);

    return {
      vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getVoucher(id: string) {
    const voucher = await this.findVoucher(id);
    return { voucher };
  }

  async createVoucher(dto: CreateVoucherDto) {
    const startsAt = this.toOptionalDate(dto.startsAt);
    const endsAt = this.toOptionalDate(dto.endsAt);
    this.validateRules({
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minSubtotal: dto.minSubtotal,
      maxDiscount: dto.maxDiscount ?? null,
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      startsAt,
      endsAt,
    });

    try {
      const voucher = await this.prismaService.voucher.create({
        data: {
          code: this.normalizeCode(dto.code),
          name: this.normalizeRequiredText(dto.name, 'name'),
          description: this.normalizeOptionalText(dto.description),
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          minSubtotal: dto.minSubtotal,
          maxDiscount: dto.maxDiscount ?? null,
          usageLimit: dto.usageLimit ?? null,
          perUserLimit: dto.perUserLimit ?? null,
          startsAt,
          endsAt,
          isActive: dto.isActive ?? true,
        },
        select: voucherSelect,
      });

      return { voucher };
    } catch (error) {
      this.rethrowUniqueCodeError(error);
      throw error;
    }
  }

  async updateVoucher(id: string, dto: UpdateVoucherDto) {
    const existing = await this.findVoucher(id);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException({
        code: 'VOUCHER_UPDATE_EMPTY',
        message: 'Provide at least one voucher field to update.',
      });
    }

    if ('isActive' in dto && typeof dto.isActive !== 'boolean') {
      throw this.ruleException('Active status must be a boolean.');
    }

    const startsAt = 'startsAt' in dto ? this.toOptionalDate(dto.startsAt) : existing.startsAt;
    const endsAt = 'endsAt' in dto ? this.toOptionalDate(dto.endsAt) : existing.endsAt;
    this.validateRules({
      discountType: dto.discountType ?? existing.discountType,
      discountValue: dto.discountValue ?? existing.discountValue,
      minSubtotal: dto.minSubtotal ?? existing.minSubtotal,
      maxDiscount: 'maxDiscount' in dto ? dto.maxDiscount ?? null : existing.maxDiscount,
      usageLimit: 'usageLimit' in dto ? dto.usageLimit ?? null : existing.usageLimit,
      perUserLimit:
        'perUserLimit' in dto ? dto.perUserLimit ?? null : existing.perUserLimit,
      startsAt,
      endsAt,
    });

    const data: Prisma.VoucherUpdateInput = {};
    if ('code' in dto) data.code = this.normalizeCode(dto.code as string);
    if ('name' in dto) data.name = this.normalizeRequiredText(dto.name as string, 'name');
    if ('description' in dto) data.description = this.normalizeOptionalText(dto.description);
    if ('discountType' in dto) data.discountType = dto.discountType;
    if ('discountValue' in dto) data.discountValue = dto.discountValue;
    if ('minSubtotal' in dto) data.minSubtotal = dto.minSubtotal;
    if ('maxDiscount' in dto) data.maxDiscount = dto.maxDiscount ?? null;
    if ('usageLimit' in dto) data.usageLimit = dto.usageLimit ?? null;
    if ('perUserLimit' in dto) data.perUserLimit = dto.perUserLimit ?? null;
    if ('startsAt' in dto) data.startsAt = startsAt;
    if ('endsAt' in dto) data.endsAt = endsAt;
    if ('isActive' in dto) data.isActive = dto.isActive;

    try {
      const voucher = await this.prismaService.voucher.update({
        where: { id },
        data,
        select: voucherSelect,
      });
      return { voucher };
    } catch (error) {
      this.rethrowUniqueCodeError(error);
      throw error;
    }
  }

  async setVoucherActive(id: string, isActive: boolean) {
    await this.findVoucher(id);
    const voucher = await this.prismaService.voucher.update({
      where: { id },
      data: { isActive },
      select: voucherSelect,
    });
    return { voucher };
  }

  private async findVoucher(id: string) {
    const voucher = await this.prismaService.voucher.findUnique({
      where: { id },
      select: voucherSelect,
    });
    if (!voucher) {
      throw new NotFoundException({
        code: 'VOUCHER_NOT_FOUND',
        message: 'Voucher was not found.',
      });
    }
    return voucher;
  }

  private validateRules(state: VoucherRuleState) {
    if (
      state.discountValue <= 0 ||
      (state.discountType === VoucherDiscountType.PERCENT && state.discountValue > 100)
    ) {
      throw this.ruleException(
        state.discountType === VoucherDiscountType.PERCENT
          ? 'Percent discount value must be greater than 0 and at most 100.'
          : 'Fixed discount value must be greater than 0.',
      );
    }
    if (state.minSubtotal < 0) {
      throw this.ruleException('Minimum subtotal must be at least 0.');
    }
    if (state.maxDiscount !== null && state.maxDiscount <= 0) {
      throw this.ruleException('Maximum discount must be greater than 0.');
    }
    if (state.usageLimit !== null && (!Number.isInteger(state.usageLimit) || state.usageLimit <= 0)) {
      throw this.ruleException('Usage limit must be a positive integer.');
    }
    if (
      state.perUserLimit !== null &&
      (!Number.isInteger(state.perUserLimit) || state.perUserLimit <= 0)
    ) {
      throw this.ruleException('Per-user limit must be a positive integer.');
    }
    if (state.startsAt && state.endsAt && state.startsAt >= state.endsAt) {
      throw this.ruleException('Start date must be before end date.');
    }
  }

  private normalizeCode(value: string): string {
    const code = value.trim().toUpperCase();
    if (!code || /\s/.test(code)) {
      throw this.ruleException('Voucher code is required and must not contain spaces.');
    }
    return code;
  }

  private normalizeRequiredText(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) throw this.ruleException(`${field} is required.`);
    return normalized;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized || null;
  }

  private toOptionalDate(value?: string | null): Date | null {
    return value ? new Date(value) : null;
  }

  private ruleException(message: string) {
    return new BadRequestException({ code: 'VOUCHER_RULE_INVALID', message });
  }

  private rethrowUniqueCodeError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: 'VOUCHER_CODE_EXISTS',
        message: 'A voucher with this code already exists.',
      });
    }
  }
}
