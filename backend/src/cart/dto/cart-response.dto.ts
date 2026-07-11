import { ApiProperty } from '@nestjs/swagger';

export class CartProductCategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'T-Shirts' })
  name: string;

  @ApiProperty({ example: 't-shirts' })
  slug: string;
}

export class CartProductSnapshotResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Classic Cotton T-Shirt' })
  name: string;

  @ApiProperty({ example: 'classic-cotton-t-shirt' })
  slug: string;

  @ApiProperty({
    example: ['https://example.com/images/classic-cotton-t-shirt.jpg'],
    type: [String],
  })
  imageUrls: string[];

  @ApiProperty({
    example: 'https://example.com/images/classic-cotton-t-shirt.jpg',
    nullable: true,
  })
  firstImageUrl: string | null;

  @ApiProperty({ type: CartProductCategoryResponseDto })
  category: CartProductCategoryResponseDto;
}

export class CartVariantDisplayResponseDto {
  @ApiProperty({ example: 'TEE-BASIC-BLK-M', nullable: true })
  sku: string | null;

  @ApiProperty({ example: 'M' })
  size: string;

  @ApiProperty({ example: 'Black' })
  color: string;

  @ApiProperty({ example: 259000, nullable: true })
  priceOverride: number | null;

  @ApiProperty({ example: 24 })
  stock: number;
}

export class CartItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  variantId: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 249000 })
  currentUnitPrice: number;

  @ApiProperty({ example: 498000 })
  currentLineTotal: number;

  @ApiProperty({ example: 24 })
  availableStock: number;

  @ApiProperty({ type: CartProductSnapshotResponseDto })
  product: CartProductSnapshotResponseDto;

  @ApiProperty({ type: CartVariantDisplayResponseDto })
  variant: CartVariantDisplayResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CartResponseDto {
  @ApiProperty({ nullable: true })
  id: string | null;

  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty({ example: 2 })
  totalQuantity: number;

  @ApiProperty({ example: 498000 })
  estimatedSubtotal: number;

  @ApiProperty({ nullable: true })
  createdAt: Date | null;

  @ApiProperty({ nullable: true })
  updatedAt: Date | null;
}
