import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const normalizeText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

const normalizeStringArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) =>
        typeof item === 'string' ? item.trim().replace(/\s+/g, ' ') : item,
      )
    : value;

const normalizedArrayIdentity = (value: unknown) =>
  typeof value === 'string' ? value.toLocaleLowerCase() : value;

export class StyleAdviceRequestDto {
  @ApiPropertyOptional({ example: 'A summer wedding', maxLength: 80 })
  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  occasion?: string;

  @ApiPropertyOptional({ example: 'Minimal smart casual', maxLength: 80 })
  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  style?: string;

  @ApiPropertyOptional({ example: 800000, maximum: 2_000_000_000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  budget?: number;

  @ApiPropertyOptional({ example: 'Pear shape', maxLength: 80 })
  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  bodyType?: string;

  @ApiPropertyOptional({ example: ['Black', 'Cream'], maxItems: 5, type: [String] })
  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique(normalizedArrayIdentity)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  preferredColors?: string[];

  @ApiPropertyOptional({ example: ['M', 'L'], maxItems: 5, type: [String] })
  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique(normalizedArrayIdentity)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  preferredSizes?: string[];

  @ApiPropertyOptional({ example: 'I prefer light layers.', maxLength: 500 })
  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  notes?: string;
}

export class StyleAdviceRecommendationDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'relaxed-oxford-shirt' })
  productSlug: string;

  @ApiProperty({ example: 'Relaxed Oxford Shirt' })
  productName: string;

  @ApiPropertyOptional({ example: 'https://example.com/oxford-shirt.jpg' })
  imageUrl?: string;

  @ApiProperty({ example: 499000 })
  price: number;

  @ApiProperty({ example: 'A versatile option that fits the requested look.' })
  reason: string;

  @ApiPropertyOptional({ example: 'Pair it with neutral trousers.' })
  stylingTip?: string;
}

export class StyleAdviceResponseDto {
  @ApiProperty({ enum: ['ai', 'catalog_fallback'] })
  @IsIn(['ai', 'catalog_fallback'])
  mode: 'ai' | 'catalog_fallback';

  @ApiProperty()
  summary: string;

  @ApiProperty({ type: [StyleAdviceRecommendationDto] })
  recommendations: StyleAdviceRecommendationDto[];

  @ApiProperty({ type: [String] })
  extraTips: string[];
}

export interface NormalizedStyleAdviceRequest {
  occasion?: string;
  style?: string;
  budget?: number;
  bodyType?: string;
  preferredColors: string[];
  preferredSizes: string[];
  notes?: string;
}
