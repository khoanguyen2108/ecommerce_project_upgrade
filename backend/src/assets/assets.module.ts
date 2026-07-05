import { Module } from '@nestjs/common';
import { AssetService } from './asset.service';
import { STORAGE_PROVIDER } from './storage-provider';
import { SupabaseStorageProvider } from './supabase-storage.provider';

@Module({
  providers: [
    AssetService,
    SupabaseStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: SupabaseStorageProvider,
    },
  ],
  exports: [AssetService],
})
export class AssetsModule {}
