import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums';

export const ADMIN_REVENUE_GROUP_BY_OPTIONS = [
  'day',
  'week',
  'month',
] as const;
export type AdminRevenueGroupBy =
  (typeof ADMIN_REVENUE_GROUP_BY_OPTIONS)[number];

export class AdminStatsDateRangeQueryDto {
  @ApiPropertyOptional({
    description:
      'Inclusive date/time lower bound. Revenue endpoints apply this to paidAt.',
    example: '2026-06-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive date/time upper bound. A YYYY-MM-DD value is treated as the end of that UTC day.',
    example: '2026-06-30T23:59:59.999Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

export class AdminRevenueQueryDto extends AdminStatsDateRangeQueryDto {
  @ApiPropertyOptional({
    default: 'day',
    enum: ADMIN_REVENUE_GROUP_BY_OPTIONS,
    example: 'day',
  })
  @IsOptional()
  @IsIn(ADMIN_REVENUE_GROUP_BY_OPTIONS)
  groupBy?: AdminRevenueGroupBy;
}

export class AdminTopProductsQueryDto extends AdminStatsDateRangeQueryDto {
  @ApiPropertyOptional({
    default: 10,
    example: 10,
    maximum: 50,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AdminOrderStatsQueryDto extends AdminStatsDateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Optional status filter for the order count breakdown.',
    enum: OrderStatus,
    example: OrderStatus.PENDING_PAYMENT,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
