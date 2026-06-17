import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { OrderExpiryService } from './order-expiry.service';

@Module({
  imports: [EmailModule],
  providers: [OrderExpiryService],
  exports: [OrderExpiryService],
})
export class OrderExpiryModule {}
