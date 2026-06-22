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
import {
  OrderFulfillmentStatus,
  OrderStatus,
} from '../../generated/prisma/enums';

export const ADMIN_ORDER_SORT_OPTIONS = [
  'createdAt',
  'updatedAt',
  'totalAmount',
  'paidAt',
] as const;
export type AdminOrderSort = (typeof ADMIN_ORDER_SORT_OPTIONS)[number];

export const ADMIN_ORDER_ORDER_OPTIONS = ['asc', 'desc'] as const;
export type AdminOrderOrder = (typeof ADMIN_ORDER_ORDER_OPTIONS)[number];

export class AdminOrderQueryDto {
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
    enum: OrderStatus,
    example: OrderStatus.PENDING_PAYMENT,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: OrderFulfillmentStatus,
    example: OrderFulfillmentStatus.IN_TRANSIT,
  })
  @IsOptional()
  @IsEnum(OrderFulfillmentStatus)
  fulfillmentStatus?: OrderFulfillmentStatus;

  @ApiPropertyOptional({
    description:
      'Searches user email, exact order UUID, or exact payment provider order code.',
    example: 'customer@example.com',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

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
      'Inclusive order createdAt lower bound. Use ISO 8601 date or datetime.',
    example: '2026-06-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive order createdAt upper bound. A YYYY-MM-DD value is treated as the end of that UTC day.',
    example: '2026-06-30T23:59:59.999Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ADMIN_ORDER_SORT_OPTIONS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(ADMIN_ORDER_SORT_OPTIONS)
  sort?: AdminOrderSort;

  @ApiPropertyOptional({
    default: 'desc',
    enum: ADMIN_ORDER_ORDER_OPTIONS,
    example: 'desc',
  })
  @IsOptional()
  @IsIn(ADMIN_ORDER_ORDER_OPTIONS)
  order?: AdminOrderOrder;
}
