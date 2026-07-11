import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum SavedOutfitItemRole {
  TOP = 'top',
  BOTTOM = 'bottom',
  SHOES = 'shoes',
  JACKET = 'jacket',
  ACCESSORY = 'accessory',
  HANDBAG = 'handbag',
}

const trimSnapshotText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class SavedOutfitItemSnapshotDto {
  @ApiProperty({ enum: SavedOutfitItemRole, example: 'top' })
  @IsEnum(SavedOutfitItemRole)
  role: SavedOutfitItemRole;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID('4')
  productId: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  @ApiProperty({ example: 'Classic Cotton Tee', maxLength: 160 })
  @Transform(trimSnapshotText)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  productNameSnapshot: string;

  @ApiProperty({ example: 'classic-cotton-tee', maxLength: 180 })
  @Transform(trimSnapshotText)
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  productSlugSnapshot: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/products/classic-cotton-tee.webp',
    maxLength: 2048,
  })
  @IsOptional()
  @Transform(trimSnapshotText)
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  imageUrlSnapshot?: string;

  @ApiProperty({ example: 250000, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  unitPriceSnapshot: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 1 })
  @IsInt()
  @Equals(1)
  quantity: number;
}

export class CreateSavedOutfitDto {
  @ApiProperty({
    example: 'Streetwear outfit with a black tee and boots',
    maxLength: 500,
  })
  @Transform(trimSnapshotText)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  sourcePrompt: string;

  @ApiProperty({ enum: ['vi', 'en'], example: 'en' })
  @IsString()
  @IsIn(['vi', 'en'])
  locale: 'vi' | 'en';

  @ApiProperty({
    example: 'A relaxed three-piece streetwear outfit.',
    maxLength: 300,
  })
  @Transform(trimSnapshotText)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  summary: string;

  @ApiProperty({
    type: [SavedOutfitItemSnapshotDto],
    minItems: 1,
    maxItems: 6,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => SavedOutfitItemSnapshotDto)
  items: SavedOutfitItemSnapshotDto[];
}
