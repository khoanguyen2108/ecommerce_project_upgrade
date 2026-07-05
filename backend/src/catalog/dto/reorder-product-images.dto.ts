import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { MAX_PRODUCT_IMAGES } from '../../assets/asset.service';

export class ReorderProductImagesDto {
  @ApiProperty({
    description: 'All managed product image IDs in desired display order.',
    maxItems: MAX_PRODUCT_IMAGES,
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  imageIds: string[];
}
