import { Module } from '@nestjs/common';
import { OrderExpiryService } from './order-expiry.service';

@Module({
  providers: [OrderExpiryService],
  exports: [OrderExpiryService],
})
export class OrderExpiryModule {}
