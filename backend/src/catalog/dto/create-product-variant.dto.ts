import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductVariantDto {
  @ApiPropertyOptional({
    example: 'TEE-BASIC-BLK-M',
    maxLength: 80,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @ApiProperty({
    example: 'M',
    maxLength: 32,
  })
  @IsString()
  @MaxLength(32)
  size: string;

  @ApiProperty({
    example: 'Black',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  color: string;

  @ApiProperty({
    example: 24,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  stock: number;

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
    default: true,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
