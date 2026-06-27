import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const MAX_VND_AMOUNT = 2_000_000_000;
const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SAFE_TEXT_PATTERN =
  /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;

const normalizeTextValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  if (DISALLOWED_CONTROL_CHARACTERS.test(value)) {
    return value;
  }

  return value.trim().replace(/[ \t\r\n]+/g, ' ');
};

const normalizeText = ({ value }: { value: unknown }) =>
  normalizeTextValue(value);

const normalizeStringArray = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map(normalizeTextValue) : value;

const normalizeCategorySlugs = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => {
        const normalized = normalizeTextValue(item);

        if (
          typeof normalized !== 'string' ||
          DISALLOWED_CONTROL_CHARACTERS.test(normalized)
        ) {
          return normalized;
        }

        return normalized
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      })
    : value;

const normalizeSizes = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => {
        const normalized = normalizeTextValue(item);
        return typeof normalized === 'string'
          ? normalized.toUpperCase()
          : normalized;
      })
    : value;

const normalizedArrayIdentity = (value: unknown) =>
  typeof value === 'string' ? value.toLocaleLowerCase() : value;

@ValidatorConstraint({ name: 'recommendProductsBudgetRange', async: false })
class RecommendProductsBudgetRangeConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const request = args.object as RecommendProductsRequestDto;

    return (
      request.minBudget === undefined ||
      request.maxBudget === undefined ||
      request.minBudget <= request.maxBudget
    );
  }

  defaultMessage(): string {
    return 'minBudget must be less than or equal to maxBudget.';
  }
}

export class RecommendProductsRequestDto {
  @ApiProperty({
    example: 'Recommend black oversized pieces under 500k',
    maxLength: 500,
    minLength: 3,
  })
  @Transform(normalizeText)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @Matches(SAFE_TEXT_PATTERN)
  query: string;

  @ApiPropertyOptional({
    example: 200000,
    maximum: MAX_VND_AMOUNT,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_VND_AMOUNT)
  minBudget?: number;

  @ApiPropertyOptional({
    example: 500000,
    maximum: MAX_VND_AMOUNT,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_VND_AMOUNT)
  @Validate(RecommendProductsBudgetRangeConstraint)
  maxBudget?: number;

  @ApiPropertyOptional({
    example: ['t-shirts', 'outerwear'],
    maxItems: 5,
    type: [String],
  })
  @IsOptional()
  @Transform(normalizeCategorySlugs)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique(normalizedArrayIdentity)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(160, { each: true })
  @Matches(SAFE_TEXT_PATTERN, { each: true })
  categorySlugs?: string[];

  @ApiPropertyOptional({
    example: ['Black', 'Cream'],
    maxItems: 5,
    type: [String],
  })
  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique(normalizedArrayIdentity)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  @Matches(SAFE_TEXT_PATTERN, { each: true })
  colors?: string[];

  @ApiPropertyOptional({
    example: ['M', 'L'],
    maxItems: 5,
    type: [String],
  })
  @IsOptional()
  @Transform(normalizeSizes)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique(normalizedArrayIdentity)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  @Matches(SAFE_TEXT_PATTERN, { each: true })
  sizes?: string[];

  @ApiPropertyOptional({ default: 6, maximum: 8, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  limit: number = 6;
}

export class RecommendProductsAppliedFiltersDto {
  @ApiPropertyOptional({ example: 200000 })
  minBudget?: number;

  @ApiPropertyOptional({ example: 500000 })
  maxBudget?: number;

  @ApiProperty({ example: ['t-shirts'], type: [String] })
  categorySlugs: string[];

  @ApiProperty({ example: ['Black'], type: [String] })
  colors: string[];

  @ApiProperty({ example: ['M'], type: [String] })
  sizes: string[];

  @ApiProperty({ example: true })
  activeOnly: true;

  @ApiProperty({ example: true })
  inStockOnly: true;
}

export class RecommendProductsRecommendationDto {
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

  @ApiProperty({ example: ['Black'], type: [String] })
  availableColors: string[];

  @ApiProperty({ example: ['M', 'L'], type: [String] })
  availableSizes: string[];

  @ApiProperty({ example: 'This in-stock piece fits the requested look.' })
  reason: string;
}

export class RecommendProductsResponseDto {
  @ApiProperty({ enum: ['ai', 'catalog_fallback'] })
  @IsIn(['ai', 'catalog_fallback'])
  mode: 'ai' | 'catalog_fallback';

  @ApiProperty()
  summary: string;

  @ApiProperty({ type: RecommendProductsAppliedFiltersDto })
  appliedFilters: RecommendProductsAppliedFiltersDto;

  @ApiProperty({ type: [RecommendProductsRecommendationDto] })
  recommendations: RecommendProductsRecommendationDto[];

  @ApiProperty({ type: [String] })
  noMatchSuggestions: string[];
}

export interface NormalizedRecommendProductsRequest {
  query: string;
  minBudget?: number;
  maxBudget?: number;
  categorySlugs: string[];
  colors: string[];
  sizes: string[];
  limit: number;
}
