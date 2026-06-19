import { ApiProperty } from '@nestjs/swagger';
import { VoucherDiscountType } from '../../generated/prisma/enums';

export class CheckoutVoucherResponseDto {
  @ApiProperty({ example: 'SAVE10' })
  code: string;

  @ApiProperty({ example: 'Save ten percent' })
  name: string;

  @ApiProperty({ enum: VoucherDiscountType })
  discountType: VoucherDiscountType;

  @ApiProperty({ example: 10 })
  discountValue: number;

  @ApiProperty({ example: 50000, nullable: true })
  maxDiscount: number | null;

  @ApiProperty({ example: 300000 })
  minSubtotal: number;
}

export class CheckoutVoucherErrorResponseDto {
  @ApiProperty({ example: 'CHECKOUT_VOUCHER_MIN_SUBTOTAL' })
  code: string;

  @ApiProperty({ example: 'A minimum subtotal of 300000 VND is required.' })
  message: string;
}

export class CheckoutSummaryItemResponseDto {
  @ApiProperty()
  cartItemId: string;

  @ApiProperty()
  variantId: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ example: 'Classic Cotton T-Shirt' })
  productName: string;

  @ApiProperty({ example: 'classic-cotton-t-shirt' })
  productSlug: string;

  @ApiProperty({
    example: 'https://example.com/images/classic-cotton-t-shirt.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    example: ['https://example.com/images/classic-cotton-t-shirt.jpg'],
    type: [String],
  })
  imageUrls: string[];

  @ApiProperty({ example: 'T-Shirts' })
  categoryName: string;

  @ApiProperty({ example: 't-shirts' })
  categorySlug: string;

  @ApiProperty({ example: 'TEE-BASIC-BLK-M', nullable: true })
  sku: string | null;

  @ApiProperty({ example: 'M' })
  size: string;

  @ApiProperty({ example: 'Black' })
  color: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 24 })
  availableStock: number;

  @ApiProperty({ example: 249000 })
  currentUnitPrice: number;

  @ApiProperty({ example: 498000 })
  currentLineTotal: number;
}

export class CheckoutSummaryResponseDto {
  @ApiProperty({ type: [CheckoutSummaryItemResponseDto] })
  items: CheckoutSummaryItemResponseDto[];

  @ApiProperty({ example: 2 })
  totalQuantity: number;

  @ApiProperty({ example: 498000 })
  subtotalAmount: number;

  @ApiProperty({ example: 50000 })
  discountAmount: number;

  @ApiProperty({ example: 498000 })
  totalAmount: number;

  @ApiProperty({ nullable: true, type: CheckoutVoucherResponseDto })
  appliedVoucher: CheckoutVoucherResponseDto | null;

  @ApiProperty({ nullable: true, type: CheckoutVoucherErrorResponseDto })
  voucherError: CheckoutVoucherErrorResponseDto | null;

  @ApiProperty({ type: [CheckoutVoucherResponseDto] })
  eligibleVouchers: CheckoutVoucherResponseDto[];

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({
    example: [],
    type: [String],
  })
  warnings: string[];
}
