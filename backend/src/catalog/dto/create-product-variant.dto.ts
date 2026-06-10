import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @IsString()
  @MaxLength(32)
  size: string;

  @IsString()
  @MaxLength(64)
  color: string;

  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
