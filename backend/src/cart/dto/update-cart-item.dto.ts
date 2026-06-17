import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    example: 3,
    maximum: 99,
    minimum: 1,
  })
  @Type(() => Number)
  @Allow()
  quantity: number;
}
