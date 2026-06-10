import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  size?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  color?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
