import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { AdminLandingGalleryController } from './admin-landing-gallery.controller';
import { LandingGalleryController } from './landing-gallery.controller';
import { LandingGalleryService } from './landing-gallery.service';

@Module({
  imports: [AssetsModule, AuthModule],
  controllers: [LandingGalleryController, AdminLandingGalleryController],
  providers: [LandingGalleryService],
})
export class LandingGalleryModule {}
