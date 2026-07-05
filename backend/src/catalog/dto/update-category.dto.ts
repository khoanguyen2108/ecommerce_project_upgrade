import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    example: 'Graphic T-Shirts',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @ApiPropertyOptional({
    example: 'graphic-t-shirts',
    maxLength: 160,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string | null;

  @ApiPropertyOptional({
    example: 'Printed cotton tees.',
    maxLength: 2000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Legacy transition field. Only retaining or clearing the existing legacy URL is allowed.',
    example: 'https://images.example.com/categories/graphic-t-shirts.jpg',
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean | null;

  @ApiPropertyOptional({
    example: 2,
    maximum: 3,
    minimum: 1,
    nullable: true,
  })
  @IsOptional()
  featuredOrder?: number | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
