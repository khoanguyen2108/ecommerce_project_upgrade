import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderExpiryModule } from '../order-expiry/order-expiry.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [AuthModule, OrderExpiryModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
