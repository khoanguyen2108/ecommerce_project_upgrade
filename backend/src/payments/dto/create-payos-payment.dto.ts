import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreatePayosPaymentDto {
  @ApiProperty({
    example: '7b2cb6b6-0501-4d7b-8e30-98db06a7f605',
    format: 'uuid',
  })
  @IsUUID()
  orderId: string;
}
