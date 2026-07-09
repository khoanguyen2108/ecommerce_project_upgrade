import { ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';
import {
  MAX_PRODUCT_AI_TAG_LENGTH,
  MAX_PRODUCT_AI_TAGS,
} from '../catalog.constants';

export class UpdateProductDto {
  @ApiPropertyOptional({
    example: '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Canonical category membership for the product.',
    example: [
      '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
      '0e5ecb7c-a454-4f02-ae59-9708820fbb58',
    ],
    nullable: true,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[] | null;

  @ApiPropertyOptional({
    example: 'Classic Cotton T-Shirt',
    maxLength: 160,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @ApiPropertyOptional({
    example: 'classic-cotton-t-shirt',
    maxLength: 180,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string | null;

  @ApiPropertyOptional({
    example: 'Soft crew neck t-shirt for daily wear.',
    maxLength: 4000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({
    example: 249000,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number | null;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Legacy transition field. Only retaining, reordering, or removing existing legacy URLs is allowed.',
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
    description:
      'Internal admin-only tags for future AI product matching. Hidden from public storefront responses.',
    example: ['streetwear', 'black leather', 'chrome hearts'],
    maxItems: MAX_PRODUCT_AI_TAGS,
    nullable: true,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_AI_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_PRODUCT_AI_TAG_LENGTH, { each: true })
  aiTags?: string[] | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
