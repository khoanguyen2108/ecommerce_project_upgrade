import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CartResponseDto } from './cart-response.dto';

export class AddOutfitCartItemDto {
  @ApiProperty({
    example: '5598228d-8f08-4ddd-8869-9f0d5fb1ad77',
    format: 'uuid',
  })
  @IsUUID('4')
  productId: string;

  @ApiProperty({
    example: 'b7e6d845-fb16-42f9-9402-c3c2d363c4a1',
    format: 'uuid',
  })
  @IsUUID('4')
  variantId: string;

  @ApiProperty({
    example: 1,
    maximum: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Equals(1)
  quantity: number;
}

export class AddOutfitCartItemsDto {
  @ApiProperty({
    maxItems: 6,
    minItems: 1,
    type: [AddOutfitCartItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AddOutfitCartItemDto)
  items: AddOutfitCartItemDto[];
}

export class AddedOutfitCartItemResponseDto {
  @ApiProperty({
    example: '5598228d-8f08-4ddd-8869-9f0d5fb1ad77',
    format: 'uuid',
  })
  productId: string;

  @ApiProperty({
    example: 'b7e6d845-fb16-42f9-9402-c3c2d363c4a1',
    format: 'uuid',
  })
  variantId: string;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ example: 249000 })
  currentUnitPrice: number;
}

export class AddOutfitCartItemsResponseDto {
  @ApiProperty({ type: CartResponseDto })
  cart: CartResponseDto;

  @ApiProperty({ type: [AddedOutfitCartItemResponseDto] })
  addedItems: AddedOutfitCartItemResponseDto[];
}
