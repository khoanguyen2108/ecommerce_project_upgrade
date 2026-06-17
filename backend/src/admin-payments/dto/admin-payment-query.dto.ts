import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentProvider, PaymentStatus } from '../../generated/prisma/enums';

export const ADMIN_PAYMENT_SORT_OPTIONS = [
  'createdAt',
  'updatedAt',
  'paidAt',
  'amount',
] as const;
export type AdminPaymentSort = (typeof ADMIN_PAYMENT_SORT_OPTIONS)[number];

export const ADMIN_PAYMENT_ORDER_OPTIONS = ['asc', 'desc'] as const;
export type AdminPaymentOrder = (typeof ADMIN_PAYMENT_ORDER_OPTIONS)[number];

export class AdminPaymentQueryDto {
  @ApiPropertyOptional({
    default: 1,
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: 20,
    example: 20,
    maximum: 100,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    enum: PaymentProvider,
    example: PaymentProvider.PAYOS,
  })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Filter by order UUID.',
    example: '7b2cb6b6-0501-4d7b-8e30-98db06a7f605',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer/user UUID.',
    example: 'a6f26aef-d26e-40f2-8a58-1e36ff7f6f65',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive payment createdAt lower bound. Use ISO 8601 date or datetime.',
    example: '2026-06-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive payment createdAt upper bound. A YYYY-MM-DD value is treated as the end of that UTC day.',
    example: '2026-06-30T23:59:59.999Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    description:
      'Searches payment id, order id, user email, provider order code, payment link id, or transaction reference.',
    example: 'customer@example.com',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ADMIN_PAYMENT_SORT_OPTIONS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(ADMIN_PAYMENT_SORT_OPTIONS)
  sort?: AdminPaymentSort;

  @ApiPropertyOptional({
    default: 'desc',
    enum: ADMIN_PAYMENT_ORDER_OPTIONS,
    example: 'desc',
  })
  @IsOptional()
  @IsIn(ADMIN_PAYMENT_ORDER_OPTIONS)
  order?: AdminPaymentOrder;
}
