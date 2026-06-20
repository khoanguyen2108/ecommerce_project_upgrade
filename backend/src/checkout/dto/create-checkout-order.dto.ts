import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { AddressFieldsDto } from '../../addresses/dto/address-fields.dto';
import { CheckoutVoucherDto } from './checkout-voucher.dto';

export class CheckoutShippingInfoDto extends AddressFieldsDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  saveAddress?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  setDefault?: boolean;
}

export class CreateCheckoutOrderDto extends CheckoutVoucherDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ type: CheckoutShippingInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutShippingInfoDto)
  shippingInfo?: CheckoutShippingInfoDto;
}
