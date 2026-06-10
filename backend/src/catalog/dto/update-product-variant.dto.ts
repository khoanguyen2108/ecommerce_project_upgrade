import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProductVariantDto {
  @ApiPropertyOptional({
    example: 'TEE-BASIC-BLK-M',
    maxLength: 80,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @ApiPropertyOptional({
    example: 'L',
    maxLength: 32,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  size?: string | null;

  @ApiPropertyOptional({
    example: 'Black',
    maxLength: 64,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  color?: string | null;

  @ApiPropertyOptional({
    example: 16,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number | null;

  @ApiPropertyOptional({
    example: 259000,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
