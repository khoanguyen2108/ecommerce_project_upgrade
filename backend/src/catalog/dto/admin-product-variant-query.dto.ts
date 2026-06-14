import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ADMIN_VARIANT_STOCK_STATUS_OPTIONS = [
  'in_stock',
  'low_stock',
  'out_of_stock',
] as const;
export type AdminVariantStockStatus =
  (typeof ADMIN_VARIANT_STOCK_STATUS_OPTIONS)[number];

export const ADMIN_VARIANT_SORT_OPTIONS = [
  'createdAt',
  'updatedAt',
  'sku',
  'size',
  'color',
  'stock',
  'isActive',
] as const;
export type AdminVariantSort = (typeof ADMIN_VARIANT_SORT_OPTIONS)[number];

export const ADMIN_VARIANT_ORDER_OPTIONS = ['asc', 'desc'] as const;
export type AdminVariantOrder = (typeof ADMIN_VARIANT_ORDER_OPTIONS)[number];

const transformOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
};

export class AdminProductVariantQueryDto {
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
    example: 'TEE-BASIC',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiPropertyOptional({
    example: 'M',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  size?: string;

  @ApiPropertyOptional({
    example: 'Black',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  color?: string;

  @ApiPropertyOptional({
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: ADMIN_VARIANT_STOCK_STATUS_OPTIONS,
    example: 'in_stock',
  })
  @IsOptional()
  @IsIn(ADMIN_VARIANT_STOCK_STATUS_OPTIONS)
  stockStatus?: AdminVariantStockStatus;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ADMIN_VARIANT_SORT_OPTIONS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(ADMIN_VARIANT_SORT_OPTIONS)
  sort?: AdminVariantSort;

  @ApiPropertyOptional({
    default: 'desc',
    enum: ADMIN_VARIANT_ORDER_OPTIONS,
    example: 'desc',
  })
  @IsOptional()
  @IsIn(ADMIN_VARIANT_ORDER_OPTIONS)
  order?: AdminVariantOrder;
}
