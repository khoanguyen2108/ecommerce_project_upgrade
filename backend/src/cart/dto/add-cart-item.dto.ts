import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsUUID } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({
    example: 'b7e6d845-fb16-42f9-9402-c3c2d363c4a1',
    format: 'uuid',
  })
  @IsUUID()
  variantId: string;

  @ApiProperty({
    example: 2,
    maximum: 99,
    minimum: 1,
  })
  @Type(() => Number)
  @Allow()
  quantity: number;
}
