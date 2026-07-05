export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StorageUploadInput {
  body: Buffer;
  contentType: string;
  path: string;
}

export interface StoredObject {
  bucket: string;
  path: string;
  publicUrl: string;
}

export interface StorageProvider {
  delete(path: string): Promise<void>;
  isConfigured(): boolean;
  upload(input: StorageUploadInput): Promise<StoredObject>;
}
