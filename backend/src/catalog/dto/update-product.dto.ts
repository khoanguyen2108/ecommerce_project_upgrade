import {
  ArrayMaxSize,
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

export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[] | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
