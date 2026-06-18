import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminLandingPageController } from './admin-landing-page.controller';
import { LandingPageController } from './landing-page.controller';
import { LandingPageService } from './landing-page.service';

@Module({
  imports: [AuthModule],
  controllers: [LandingPageController, AdminLandingPageController],
  providers: [LandingPageService],
})
export class LandingPageModule {}
