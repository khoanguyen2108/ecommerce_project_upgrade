import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsDefined,
  IsInt,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AddressFieldsDto } from '../../addresses/dto/address-fields.dto';
import { CheckoutVoucherDto } from './checkout-voucher.dto';

export class GuestCheckoutItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ maximum: 99, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class GuestCheckoutSummaryDto extends CheckoutVoucherDto {
  @ApiProperty({ type: [GuestCheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GuestCheckoutItemDto)
  items: GuestCheckoutItemDto[];
}

export class GuestCheckoutShippingInfoDto extends AddressFieldsDto {
  @ApiProperty({ example: 'guest@example.com', maxLength: 320 })
  @IsDefined()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class CreateGuestCheckoutOrderDto extends GuestCheckoutSummaryDto {
  @ApiProperty({ type: GuestCheckoutShippingInfoDto })
  @ValidateNested()
  @Type(() => GuestCheckoutShippingInfoDto)
  shippingInfo: GuestCheckoutShippingInfoDto;
}
