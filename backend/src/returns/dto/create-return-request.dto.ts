import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const RETURN_REASONS = [
  'WRONG_SIZE',
  'WRONG_ITEM',
  'DAMAGED',
  'CHANGED_MIND',
  'OTHER',
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

const normalizeOptionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/[ \t\r\n]+/g, ' ');
  return normalized || undefined;
};

export class CreateReturnRequestDto {
  @ApiProperty({ example: 'BK000001', pattern: '^BK\\d{6,}$' })
  @IsString()
  @Matches(/^BK\d{6,}$/)
  orderCode: string;

  @ApiProperty({ enum: RETURN_REASONS, example: 'WRONG_SIZE' })
  @IsIn(RETURN_REASONS)
  reason: ReturnReason;

  @ApiPropertyOptional({ example: 'The item is smaller than expected.', maxLength: 1000 })
  @Transform(normalizeOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
