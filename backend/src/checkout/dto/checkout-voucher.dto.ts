import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const normalizeVoucherCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CheckoutVoucherDto {
  @ApiPropertyOptional({ example: 'SAVE10', maxLength: 64 })
  @IsOptional()
  @Transform(normalizeVoucherCode)
  @IsString()
  @MaxLength(64)
  @Matches(/^\S+$/, { message: 'voucherCode must not contain spaces' })
  voucherCode?: string;
}
