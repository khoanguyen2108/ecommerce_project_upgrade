import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [PaymentsController],
  exports: [PaymentsService],
  providers: [PaymentsService],
})
export class PaymentsModule {}
