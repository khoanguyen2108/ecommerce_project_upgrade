import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderFulfillmentStatus } from '../../generated/prisma/enums';

export class UpdateOrderFulfillmentStatusDto {
  @ApiProperty({
    enum: OrderFulfillmentStatus,
    example: OrderFulfillmentStatus.IN_TRANSIT,
  })
  @IsEnum(OrderFulfillmentStatus)
  fulfillmentStatus!: OrderFulfillmentStatus;
}
