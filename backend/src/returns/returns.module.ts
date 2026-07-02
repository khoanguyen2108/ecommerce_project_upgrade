import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminReturnsController } from './admin-returns.controller';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [AuthModule],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
