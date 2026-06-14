import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class PayosStatusQueryDto {
  @ApiPropertyOptional({
    description: 'Order UUID returned by the backend.',
    example: '7b2cb6b6-0501-4d7b-8e30-98db06a7f605',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'payOS order code returned by the backend payment create API.',
    example: 100001,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderCode?: number;
}
