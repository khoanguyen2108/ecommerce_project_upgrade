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

export const ADMIN_CATEGORY_SORT_OPTIONS = [
  'createdAt',
  'updatedAt',
  'name',
  'slug',
  'sortOrder',
  'isActive',
] as const;
export type AdminCategorySort = (typeof ADMIN_CATEGORY_SORT_OPTIONS)[number];

export const ADMIN_CATEGORY_ORDER_OPTIONS = ['asc', 'desc'] as const;
export type AdminCategoryOrder = (typeof ADMIN_CATEGORY_ORDER_OPTIONS)[number];

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

export class AdminCategoryQueryDto {
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
    example: 'shirts',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    default: 'sortOrder',
    enum: ADMIN_CATEGORY_SORT_OPTIONS,
    example: 'sortOrder',
  })
  @IsOptional()
  @IsIn(ADMIN_CATEGORY_SORT_OPTIONS)
  sort?: AdminCategorySort;

  @ApiPropertyOptional({
    default: 'desc',
    enum: ADMIN_CATEGORY_ORDER_OPTIONS,
    example: 'desc',
  })
  @IsOptional()
  @IsIn(ADMIN_CATEGORY_ORDER_OPTIONS)
  order?: AdminCategoryOrder;
}
