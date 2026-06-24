import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [AdminPaymentsController],
  providers: [AdminPaymentsService],
})
export class AdminPaymentsModule {}
