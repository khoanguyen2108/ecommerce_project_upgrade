import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { VoucherDiscountType } from '../../generated/prisma/enums';

const normalizeVoucherCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateVoucherDto {
  @ApiProperty({ example: 'SAVE10', maxLength: 64 })
  @Transform(normalizeVoucherCode)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^\S+$/, { message: 'code must not contain spaces' })
  code: string;

  @ApiProperty({ example: 'Save ten percent', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ enum: VoucherDiscountType, example: VoucherDiscountType.PERCENT })
  @IsEnum(VoucherDiscountType)
  discountType: VoucherDiscountType;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  discountValue: number;

  @ApiProperty({ example: 300000, minimum: 0 })
  @IsInt()
  @Min(0)
  minSubtotal: number;

  @ApiPropertyOptional({ example: 50000, minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDiscount?: number | null;

  @ApiPropertyOptional({ example: 100, minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @ApiPropertyOptional({ example: 1, minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number | null;

  @ApiPropertyOptional({ example: '2026-06-20T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ example: '2026-07-20T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ default: true, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
