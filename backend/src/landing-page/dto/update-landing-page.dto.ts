import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateLandingPageDto {
  @ApiPropertyOptional({
    example: 'https://images.example.com/landing/hero.jpg',
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  heroImageUrl?: string | null;

  @ApiPropertyOptional({
    example: 'New season essentials',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  heroEyebrow?: string | null;

  @ApiPropertyOptional({
    example: 'Elevate your everyday wardrobe',
    maxLength: 160,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  heroTitle?: string | null;

  @ApiPropertyOptional({
    example: 'Crisp cotton, soft tailoring, and easy layers.',
    maxLength: 300,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  heroSubtitle?: string | null;
}
