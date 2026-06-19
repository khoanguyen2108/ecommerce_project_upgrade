import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminVouchersController } from './admin-vouchers.controller';
import { AdminVouchersService } from './admin-vouchers.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminVouchersController],
  providers: [AdminVouchersService],
})
export class AdminVouchersModule {}
