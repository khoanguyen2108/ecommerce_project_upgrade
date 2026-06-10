import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    example: '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

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
    example: ['https://example.com/images/classic-cotton-t-shirt.jpg'],
    maxItems: 12,
    nullable: true,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[] | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
