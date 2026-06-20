import { PartialType } from '@nestjs/swagger';
import { AddressFieldsDto } from './address-fields.dto';

export class UpdateAddressDto extends PartialType(AddressFieldsDto) {}
