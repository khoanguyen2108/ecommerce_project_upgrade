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

export class CreateProductDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsString()
  @MaxLength(180)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsInt()
  @Min(0)
  basePrice: number;

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
