import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class AddressFieldsDto {
  @ApiProperty({ example: 'Nguyen Van An', maxLength: 120 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  recipientName: string;

  @ApiProperty({ example: '0901234567', maxLength: 20 })
  @Transform(trimText)
  @IsString()
  @Matches(/^(?:\+84|0)\d{9}$/, {
    message: 'phone must be a valid Vietnamese phone number',
  })
  phone: string;

  @ApiProperty({ example: 'Ho Chi Minh City', maxLength: 120 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  province: string;

  @ApiProperty({ example: 'District 1', maxLength: 120 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  district: string;

  @ApiProperty({ example: 'Ben Nghe Ward', maxLength: 120 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ward: string;

  @ApiProperty({ example: '12 Nguyen Hue Street', maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  addressLine: string;

  @ApiPropertyOptional({ example: 'Call before delivery', maxLength: 500 })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateAddressDto extends AddressFieldsDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
