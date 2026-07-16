import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const CATEGORY_REORDER_DIRECTIONS = ['up', 'down'] as const;
export type CategoryReorderDirection =
  (typeof CATEGORY_REORDER_DIRECTIONS)[number];

export class ReorderCategoryDto {
  @ApiProperty({
    enum: CATEGORY_REORDER_DIRECTIONS,
    example: 'up',
  })
  @IsIn(CATEGORY_REORDER_DIRECTIONS)
  direction: CategoryReorderDirection;
}
