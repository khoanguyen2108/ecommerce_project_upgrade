import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { OrderExpiryModule } from '../order-expiry/order-expiry.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, EmailModule, OrderExpiryModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
