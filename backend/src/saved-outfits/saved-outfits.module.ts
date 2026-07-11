import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SavedOutfitsController } from './saved-outfits.controller';
import { SavedOutfitsService } from './saved-outfits.service';

@Module({
  imports: [AuthModule],
  controllers: [SavedOutfitsController],
  providers: [SavedOutfitsService],
})
export class SavedOutfitsModule {}
