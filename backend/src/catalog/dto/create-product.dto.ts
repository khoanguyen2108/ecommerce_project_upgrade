import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    example: '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
    format: 'uuid',
  })
  @IsUUID()
  categoryId: string;

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
    default: true,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
