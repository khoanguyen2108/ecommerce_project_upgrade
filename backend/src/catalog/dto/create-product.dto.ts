import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MAX_PRODUCT_VARIANTS,
  PRODUCT_VARIANT_LIMIT_MESSAGE,
} from '../catalog.constants';
import { CreateProductVariantDto } from './create-product-variant.dto';

export class CreateProductDto {
  @ApiPropertyOptional({
    example: '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
    format: 'uuid',
    description: 'Primary category. Retained for backward compatibility.',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Canonical category membership for the product.',
    example: [
      '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
      '0e5ecb7c-a454-4f02-ae59-9708820fbb58',
    ],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiProperty({
    example: 'Classic Cotton T-Shirt',
    maxLength: 160,
  })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({
    example: 'classic-cotton-t-shirt',
    maxLength: 180,
  })
  @IsString()
  @MaxLength(180)
  slug: string;

  @ApiPropertyOptional({
    example: 'Soft crew neck t-shirt for daily wear.',
    maxLength: 4000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiProperty({
    example: 249000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({
    example: ['https://example.com/images/classic-cotton-t-shirt.jpg'],
    maxItems: 4,
    nullable: true,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[] | null;

  @ApiPropertyOptional({
    default: true,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;

  @ApiPropertyOptional({
    description: 'Variants created atomically with the product.',
    maxItems: MAX_PRODUCT_VARIANTS,
    type: [CreateProductVariantDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_VARIANTS, {
    message: PRODUCT_VARIANT_LIMIT_MESSAGE,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}
