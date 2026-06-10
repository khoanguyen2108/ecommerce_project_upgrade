import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const PRODUCT_SORT_OPTIONS = ['newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number];

export class ProductQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(PRODUCT_SORT_OPTIONS)
  sort?: ProductSort;
}
