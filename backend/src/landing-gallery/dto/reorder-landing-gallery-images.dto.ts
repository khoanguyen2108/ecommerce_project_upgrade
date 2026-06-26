import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ReorderLandingGalleryImageItemDto {
  @ApiProperty({
    example: '4da34376-0df9-4507-9426-c3d4de8aa927',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    example: 1,
  })
  @IsInt()
  sortOrder: number;
}

export class ReorderLandingGalleryImagesDto {
  @ApiProperty({
    maxItems: 10,
    type: [ReorderLandingGalleryImageItemDto],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ReorderLandingGalleryImageItemDto)
  images: ReorderLandingGalleryImageItemDto[];
}
