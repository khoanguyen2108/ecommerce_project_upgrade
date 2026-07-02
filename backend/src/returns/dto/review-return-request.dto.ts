import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ReturnRequestStatus } from '../../generated/prisma/enums';

const REVIEW_STATUSES = [
  ReturnRequestStatus.APPROVED,
  ReturnRequestStatus.REJECTED,
] as const;

export class ReviewReturnRequestDto {
  @ApiProperty({ enum: REVIEW_STATUSES, example: ReturnRequestStatus.APPROVED })
  @IsIn(REVIEW_STATUSES)
  status: 'APPROVED' | 'REJECTED';
}
