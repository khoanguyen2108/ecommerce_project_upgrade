import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Prisma } from '../generated/prisma/client';
import { AssetProvider, AssetStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage-provider';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 4;

const IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg' },
  'image/png': { extension: 'png' },
  'image/webp': { extension: 'webp' },
} as const;

type AllowedImageMime = keyof typeof IMAGE_TYPES;

export interface ProductImageUpload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class AssetService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async uploadProductImage(
    productId: string,
    uploadedById: string,
    file: ProductImageUpload | undefined,
  ) {
    await this.assertProductExists(productId);
    const image = this.validateImage(file);
    const assetId = randomUUID();
    const storagePath = `products/${productId}/${assetId}.${IMAGE_TYPES[image.mimeType].extension}`;
    const storedObject = await this.storageProvider.upload({
      body: image.buffer,
      contentType: image.mimeType,
      path: storagePath,
    });

    try {
      const productImage = await this.prismaService.$transaction(
        async (tx) => {
          const imageCount = await tx.productImage.count({
            where: { productId },
          });

          if (imageCount >= MAX_PRODUCT_IMAGES) {
            throw this.imageLimitException();
          }

          const asset = await tx.imageAsset.create({
            data: {
              id: assetId,
              provider: AssetProvider.SUPABASE,
              bucket: storedObject.bucket,
              storagePath: storedObject.path,
              publicUrl: storedObject.publicUrl,
              originalFilename: image.originalFilename,
              mimeType: image.mimeType,
              sizeBytes: image.buffer.length,
              checksum: createHash('sha256')
                .update(image.buffer)
                .digest('hex'),
              uploadedById,
              status: AssetStatus.ACTIVE,
            },
          });

          const productImage = await tx.productImage.create({
            data: {
              productId,
              imageAssetId: asset.id,
              sortOrder: imageCount,
              isPrimary: imageCount === 0,
            },
            select: { id: true },
          });
          const managedImages = await tx.productImage.findMany({
            where: { productId },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { imageAsset: { select: { publicUrl: true } } },
          });
          await tx.product.update({
            where: { id: productId },
            data: {
              imageUrls: managedImages.map(
                (item) => item.imageAsset.publicUrl,
              ),
            },
          });

          return productImage;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return productImage;
    } catch (error) {
      try {
        await this.storageProvider.delete(storedObject.path);
      } catch {
        throw new ServiceUnavailableException({
          code: 'PRODUCT_IMAGE_METADATA_SAVE_FAILED_CLEANUP_FAILED',
          message:
            'The image could not be linked to the product and storage cleanup must be reviewed.',
        });
      }

      if (this.isWriteConflict(error)) {
        throw this.imageLimitException();
      }

      throw error;
    }
  }

  async deleteProductImage(productId: string, productImageId: string) {
    const productImage = await this.prismaService.productImage.findFirst({
      where: { id: productImageId, productId },
      select: {
        id: true,
        imageAssetId: true,
        imageAsset: { select: { storagePath: true } },
      },
    });

    if (!productImage) {
      throw new NotFoundException({
        code: 'PRODUCT_IMAGE_NOT_FOUND',
        message: 'Product image was not found.',
      });
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: productImage.id } });
      const remaining = await tx.productImage.findMany({
        where: { productId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          imageAsset: { select: { publicUrl: true } },
        },
      });

      await Promise.all(
        remaining.map((item, index) =>
          tx.productImage.update({
            where: { id: item.id },
            data: { sortOrder: index, isPrimary: index === 0 },
          }),
        ),
      );
      await tx.product.update({
        where: { id: productId },
        data: {
          imageUrls: remaining.map((item) => item.imageAsset.publicUrl),
        },
      });
    });

    try {
      await this.storageProvider.delete(productImage.imageAsset.storagePath);
      await this.prismaService.imageAsset.delete({
        where: { id: productImage.imageAssetId },
      });
      return { storageDeleted: true, warning: undefined };
    } catch {
      await this.prismaService.imageAsset.update({
        where: { id: productImage.imageAssetId },
        data: { status: AssetStatus.DELETE_FAILED },
      });

      return {
        storageDeleted: false,
        warning:
          'The product image was removed, but its Supabase object could not be deleted and requires cleanup.',
      };
    }
  }

  async reorderProductImages(productId: string, productImageIds: string[]) {
    await this.assertProductExists(productId);

    if (
      productImageIds.length > MAX_PRODUCT_IMAGES ||
      new Set(productImageIds).size !== productImageIds.length
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_IMAGE_ORDER_INVALID',
        message: 'Product image order is invalid.',
      });
    }

    const currentImages = await this.prismaService.productImage.findMany({
      where: { productId },
      select: {
        id: true,
        imageAsset: { select: { publicUrl: true } },
      },
    });
    const currentIds = new Set(currentImages.map((image) => image.id));

    if (
      currentIds.size !== productImageIds.length ||
      productImageIds.some((id) => !currentIds.has(id))
    ) {
      throw new ConflictException({
        code: 'PRODUCT_IMAGE_ORDER_STALE',
        message: 'Product images changed. Refresh and try ordering them again.',
      });
    }

    const imagesById = new Map(
      currentImages.map((image) => [image.id, image.imageAsset.publicUrl]),
    );
    await this.prismaService.$transaction([
      ...productImageIds.map((id, index) =>
        this.prismaService.productImage.update({
          where: { id },
          data: { sortOrder: index, isPrimary: index === 0 },
        }),
      ),
      this.prismaService.product.update({
        where: { id: productId },
        data: {
          imageUrls: productImageIds.map((id) => imagesById.get(id)!),
        },
      }),
    ]);
  }

  private validateImage(file: ProductImageUpload | undefined): {
    buffer: Buffer;
    mimeType: AllowedImageMime;
    originalFilename: string | null;
  } {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'PRODUCT_IMAGE_EMPTY',
        message: 'Choose a non-empty JPEG, PNG, or WebP image.',
      });
    }

    if (file.buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
      throw new BadRequestException({
        code: 'PRODUCT_IMAGE_TOO_LARGE',
        message: 'Product images must be 5 MB or smaller.',
      });
    }

    if (!(file.mimetype in IMAGE_TYPES)) {
      throw this.invalidImageTypeException();
    }

    const detectedMime = this.detectMime(file.buffer);
    if (!detectedMime || detectedMime !== file.mimetype) {
      throw this.invalidImageTypeException();
    }

    return {
      buffer: file.buffer,
      mimeType: detectedMime,
      originalFilename: this.sanitizeOriginalFilename(file.originalname),
    };
  }

  private detectMime(buffer: Buffer): AllowedImageMime | undefined {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }

    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature)) {
      return 'image/png';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }

    return undefined;
  }

  private sanitizeOriginalFilename(value: string): string | null {
    const filename = path
      .basename(value.replace(/\\/g, '/'))
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 255);

    return filename || null;
  }

  private async assertProductExists(productId: string) {
    const product = await this.prismaService.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found.',
      });
    }
  }

  private invalidImageTypeException() {
    return new BadRequestException({
      code: 'PRODUCT_IMAGE_TYPE_INVALID',
      message: 'Only genuine JPEG, PNG, and WebP images are allowed.',
    });
  }

  private imageLimitException() {
    return new ConflictException({
      code: 'PRODUCT_IMAGE_LIMIT_EXCEEDED',
      message: 'A product can include at most 4 managed images.',
    });
  }

  private isWriteConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
