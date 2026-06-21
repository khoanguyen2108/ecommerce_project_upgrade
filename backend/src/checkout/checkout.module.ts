import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { OrderExpiryModule } from '../order-expiry/order-expiry.module';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutController, GuestCheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { VoucherEligibilityService } from './voucher-eligibility.service';

@Module({
  imports: [AuthModule, EmailModule, OrderExpiryModule, PaymentsModule],
  controllers: [CheckoutController, GuestCheckoutController],
  providers: [CheckoutService, VoucherEligibilityService],
})
export class CheckoutModule {}
