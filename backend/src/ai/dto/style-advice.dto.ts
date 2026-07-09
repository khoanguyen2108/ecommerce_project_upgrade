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

export const STYLE_ADVICE_OUTFIT_PRODUCT_ROLES = [
  'top',
  'bottom',
  'shoes',
  'jacket',
  'handbag',
  'accessory',
] as const;

export type StyleAdviceOutfitProductRole =
  (typeof STYLE_ADVICE_OUTFIT_PRODUCT_ROLES)[number];

export class StyleAdviceIntentDto {
  @ApiProperty({ example: ['tee', 'bottoms', 'shoes'], type: [String] })
  categories: string[];

  @ApiProperty({ example: ['black'], type: [String] })
  colors: string[];

  @ApiProperty({ example: ['gothic', 'streetwear'], type: [String] })
  styles: string[];

  @ApiProperty({ example: ['going_out'], type: [String] })
  occasions: string[];

  @ApiProperty({ example: ['oversized'], type: [String] })
  fits: string[];

  @ApiProperty({ example: ['no_jacket'], type: [String] })
  negativeConstraints: string[];
}

export class StyleAdviceOutfitProductDto {
  @ApiProperty({ enum: STYLE_ADVICE_OUTFIT_PRODUCT_ROLES, example: 'top' })
  role: StyleAdviceOutfitProductRole;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'oversized-black-t-shirt' })
  productSlug: string;

  @ApiProperty({ example: 'Oversized Black T-Shirt' })
  productName: string;

  @ApiPropertyOptional({ example: 'https://example.com/black-t-shirt.jpg' })
  imageUrl?: string;

  @ApiProperty({ example: 399000 })
  price: number;

  @ApiProperty({ example: ['black', 'gothic', 'streetwear'], type: [String] })
  matchedTags: string[];
}

export class StyleAdviceOutfitDto {
  @ApiProperty({ example: 'Black Gothic Going Out Fit 1' })
  title: string;

  @ApiProperty({
    example:
      'Built around black, gothic, going out matches from active in-stock Belikeme products.',
  })
  reason: string;

  @ApiProperty({ example: 87 })
  score: number;

  @ApiProperty({ example: ['black', 'gothic', 'going_out'], type: [String] })
  matchedIntentTags: string[];

  @ApiProperty({ type: [StyleAdviceOutfitProductDto] })
  products: StyleAdviceOutfitProductDto[];

  @ApiProperty({ example: [], type: [String] })
  warnings: string[];
}

export class StyleAdviceResponseDto {
  @ApiProperty({ enum: ['ai', 'catalog_fallback', 'out_of_scope'] })
  @IsIn(['ai', 'catalog_fallback', 'out_of_scope'])
  mode: 'ai' | 'catalog_fallback' | 'out_of_scope';

  @ApiProperty({ example: 'I want an all black gothic outfit for going out.' })
  query: string;

  @ApiProperty({ type: StyleAdviceIntentDto })
  intent: StyleAdviceIntentDto;

  @ApiProperty()
  summary: string;

  @ApiProperty({ type: [StyleAdviceOutfitDto] })
  outfits: StyleAdviceOutfitDto[];

  @ApiProperty({ type: [StyleAdviceRecommendationDto] })
  recommendations: StyleAdviceRecommendationDto[];

  @ApiProperty({ type: [String] })
  extraTips: string[];

  @ApiProperty({ type: [String] })
  warnings: string[];
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
