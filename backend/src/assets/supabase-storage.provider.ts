import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  StorageProvider,
  StorageUploadInput,
  StoredObject,
} from './storage-provider';

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private readonly bucket?: string;
  private readonly client?: SupabaseClient;

  constructor(configService: ConfigService) {
    const url = this.getValue(configService, 'SUPABASE_URL');
    const serviceRoleKey = this.getValue(
      configService,
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    const bucket = this.getValue(configService, 'SUPABASE_IMAGE_BUCKET');
    const configuredValues = [url, serviceRoleKey, bucket].filter(Boolean);

    if (configuredValues.length === 0) {
      return;
    }

    if (configuredValues.length !== 3 || !url || !serviceRoleKey || !bucket) {
      throw new Error(
        'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_IMAGE_BUCKET must be configured together.',
      );
    }

    this.assertValidUrl(url);
    this.assertValidBucket(bucket);

    this.bucket = bucket;
    this.client = createClient(url.replace(/\/+$/, ''), serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucket);
  }

  async upload(input: StorageUploadInput): Promise<StoredObject> {
    const { client, bucket } = this.getConfiguredClient();
    const { data, error } = await client.storage
      .from(bucket)
      .upload(input.path, input.body, {
        cacheControl: '31536000',
        contentType: input.contentType,
        upsert: false,
      });

    if (error || !data.path) {
      throw this.storageUnavailableException('PRODUCT_IMAGE_UPLOAD_FAILED');
    }

    const { data: publicUrlData } = client.storage
      .from(bucket)
      .getPublicUrl(data.path);

    if (!publicUrlData.publicUrl) {
      throw this.storageUnavailableException('PRODUCT_IMAGE_URL_FAILED');
    }

    return {
      bucket,
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  }

  async delete(path: string): Promise<void> {
    const { client, bucket } = this.getConfiguredClient();
    const { error } = await client.storage.from(bucket).remove([path]);

    if (error) {
      throw this.storageUnavailableException('PRODUCT_IMAGE_DELETE_FAILED');
    }
  }

  private getConfiguredClient(): { bucket: string; client: SupabaseClient } {
    if (!this.client || !this.bucket) {
      throw this.storageUnavailableException(
        'SUPABASE_IMAGE_STORAGE_NOT_CONFIGURED',
      );
    }

    return { bucket: this.bucket, client: this.client };
  }

  private getValue(
    configService: ConfigService,
    key: string,
  ): string | undefined {
    const value = configService.get<string>(key)?.trim();
    return value || undefined;
  }

  private assertValidUrl(value: string) {
    try {
      const url = new URL(value);
      const validProtocol = url.protocol === 'https:' || url.protocol === 'http:';
      const productionProtocolValid =
        process.env.NODE_ENV !== 'production' || url.protocol === 'https:';

      if (
        !validProtocol ||
        !productionProtocolValid ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error('Invalid Supabase URL.');
      }
    } catch {
      throw new Error(
        'SUPABASE_URL must be a valid HTTP(S) URL and must use HTTPS in production.',
      );
    }
  }

  private assertValidBucket(value: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value)) {
      throw new Error(
        'SUPABASE_IMAGE_BUCKET must contain only letters, numbers, dots, underscores, and hyphens.',
      );
    }
  }

  private storageUnavailableException(code: string) {
    return new ServiceUnavailableException({
      code,
      message: 'Product image storage is temporarily unavailable.',
    });
  }
}
