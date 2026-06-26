import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateLandingGalleryImageDto {
  @ApiProperty({
    example: 'https://images.example.com/lookbook/daylight-denim.jpg',
    maxLength: 1000,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  imageUrl: string;

  @ApiPropertyOptional({
    example: 'Daylight denim',
    maxLength: 80,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string | null;

  @ApiPropertyOptional({
    example: 'Soft layers, clean lines, and late-afternoon movement.',
    maxLength: 160,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  caption?: string | null;

  @ApiPropertyOptional({
    example: 'Model wearing Belikeme denim layers outdoors',
    maxLength: 160,
    nullable: true,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  altText?: string | null;

  @ApiPropertyOptional({
    default: 0,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
