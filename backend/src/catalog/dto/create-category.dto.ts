import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'T-Shirts',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 't-shirts',
    maxLength: 160,
  })
  @IsString()
  @MaxLength(160)
  slug: string;

  @ApiPropertyOptional({
    example: 'Everyday cotton tees.',
    maxLength: 2000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://images.example.com/categories/t-shirts.jpg',
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional({
    default: false,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean | null;

  @ApiPropertyOptional({
    example: 1,
    maximum: 3,
    minimum: 1,
    nullable: true,
  })
  @IsOptional()
  featuredOrder?: number | null;

  @ApiPropertyOptional({
    default: true,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
