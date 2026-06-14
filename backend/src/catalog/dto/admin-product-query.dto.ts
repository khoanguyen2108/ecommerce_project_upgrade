import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ADMIN_PRODUCT_SORT_OPTIONS = [
  'createdAt',
  'updatedAt',
  'name',
  'slug',
  'basePrice',
  'isActive',
] as const;
export type AdminProductSort = (typeof ADMIN_PRODUCT_SORT_OPTIONS)[number];

export const ADMIN_PRODUCT_ORDER_OPTIONS = ['asc', 'desc'] as const;
export type AdminProductOrder = (typeof ADMIN_PRODUCT_ORDER_OPTIONS)[number];

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

export class AdminProductQueryDto {
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
    example: 'cotton',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    example: '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 't-shirts',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  categorySlug?: string;

  @ApiPropertyOptional({
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 100000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 500000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ADMIN_PRODUCT_SORT_OPTIONS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(ADMIN_PRODUCT_SORT_OPTIONS)
  sort?: AdminProductSort;

  @ApiPropertyOptional({
    default: 'desc',
    enum: ADMIN_PRODUCT_ORDER_OPTIONS,
    example: 'desc',
  })
  @IsOptional()
  @IsIn(ADMIN_PRODUCT_ORDER_OPTIONS)
  order?: AdminProductOrder;
}
