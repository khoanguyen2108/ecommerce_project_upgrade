import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { OrderEmailService } from './order-email.service';

@Module({
  providers: [EmailService, OrderEmailService],
  exports: [EmailService, OrderEmailService],
})
export class EmailModule {}
