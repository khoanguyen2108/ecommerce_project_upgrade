import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLandingGalleryImageDto } from './dto/create-landing-gallery-image.dto';
import type { ReorderLandingGalleryImagesDto } from './dto/reorder-landing-gallery-images.dto';
import type { UpdateLandingGalleryImageDto } from './dto/update-landing-gallery-image.dto';

const MAX_LANDING_GALLERY_IMAGES = 10;

const publicLandingGalleryImageSelect = {
  id: true,
  imageUrl: true,
  title: true,
  caption: true,
  altText: true,
  sortOrder: true,
} satisfies Prisma.LandingGalleryImageSelect;

const adminLandingGalleryImageSelect = {
  ...publicLandingGalleryImageSelect,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LandingGalleryImageSelect;

@Injectable()
export class LandingGalleryService {
  constructor(private readonly prismaService: PrismaService) {}

  async listPublicImages() {
    const images = await this.prismaService.landingGalleryImage.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: MAX_LANDING_GALLERY_IMAGES,
      select: publicLandingGalleryImageSelect,
    });

    return { images };
  }

  async listAdminImages() {
    const images = await this.prismaService.landingGalleryImage.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: adminLandingGalleryImageSelect,
    });

    return {
      images,
      count: images.length,
      maxImages: MAX_LANDING_GALLERY_IMAGES,
    };
  }

  async createAdminImage(dto: CreateLandingGalleryImageDto) {
    const image = await this.prismaService.$transaction(async (tx) => {
      const imageCount = await tx.landingGalleryImage.count();

      if (imageCount >= MAX_LANDING_GALLERY_IMAGES) {
        throw this.imageLimitExceededException();
      }

      const maxSortOrder = await tx.landingGalleryImage.aggregate({
        _max: {
          sortOrder: true,
        },
      });

      return tx.landingGalleryImage.create({
        data: {
          imageUrl: this.normalizeRequiredImageUrl(dto.imageUrl),
          title: this.normalizeOptionalText(dto.title, 80, 'title'),
          caption: this.normalizeOptionalText(dto.caption, 160, 'caption'),
          altText: this.normalizeOptionalText(dto.altText, 160, 'altText'),
          sortOrder:
            dto.sortOrder ??
            (maxSortOrder._max.sortOrder === null
              ? 0
              : maxSortOrder._max.sortOrder + 1),
          isActive: dto.isActive ?? true,
        },
        select: adminLandingGalleryImageSelect,
      });
    });

    return { image };
  }

  async updateAdminImage(id: string, dto: UpdateLandingGalleryImageDto) {
    await this.getImageForAdmin(id);

    const data: Prisma.LandingGalleryImageUpdateInput = {};

    if ('imageUrl' in dto) {
      data.imageUrl = this.normalizeRequiredImageUrl(dto.imageUrl);
    }

    if ('title' in dto) {
      data.title = this.normalizeOptionalText(dto.title, 80, 'title');
    }

    if ('caption' in dto) {
      data.caption = this.normalizeOptionalText(dto.caption, 160, 'caption');
    }

    if ('altText' in dto) {
      data.altText = this.normalizeOptionalText(dto.altText, 160, 'altText');
    }

    if ('sortOrder' in dto) {
      data.sortOrder = this.normalizeSortOrder(dto.sortOrder);
    }

    if ('isActive' in dto) {
      data.isActive = this.normalizeBoolean(dto.isActive, 'isActive');
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: 'LANDING_GALLERY_UPDATE_EMPTY',
        message: 'Provide at least one landing gallery image field to update.',
      });
    }

    const image = await this.prismaService.landingGalleryImage.update({
      where: { id },
      data,
      select: adminLandingGalleryImageSelect,
    });

    return { image };
  }

  async deleteAdminImage(id: string) {
    await this.getImageForAdmin(id);
    await this.prismaService.landingGalleryImage.delete({ where: { id } });

    return { deletedId: id };
  }

  async reorderAdminImages(dto: ReorderLandingGalleryImagesDto) {
    if (dto.images.length === 0) {
      throw new BadRequestException({
        code: 'LANDING_GALLERY_REORDER_EMPTY',
        message: 'Provide at least one landing gallery image to reorder.',
      });
    }

    const uniqueImageIds = new Set(dto.images.map((image) => image.id));

    if (uniqueImageIds.size !== dto.images.length) {
      throw new BadRequestException({
        code: 'LANDING_GALLERY_REORDER_DUPLICATE',
        message: 'Each landing gallery image can appear only once.',
      });
    }

    const images = await this.prismaService.$transaction(async (tx) => {
      const existingImages = await tx.landingGalleryImage.findMany({
        where: {
          id: {
            in: [...uniqueImageIds],
          },
        },
        select: {
          id: true,
        },
      });

      if (existingImages.length !== uniqueImageIds.size) {
        throw this.imageNotFoundException();
      }

      await Promise.all(
        dto.images.map((image) =>
          tx.landingGalleryImage.update({
            where: {
              id: image.id,
            },
            data: {
              sortOrder: this.normalizeSortOrder(image.sortOrder),
            },
          }),
        ),
      );

      return tx.landingGalleryImage.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: adminLandingGalleryImageSelect,
      });
    });

    return {
      images,
      count: images.length,
      maxImages: MAX_LANDING_GALLERY_IMAGES,
    };
  }

  private async getImageForAdmin(id: string) {
    const image = await this.prismaService.landingGalleryImage.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!image) {
      throw this.imageNotFoundException();
    }

    return image;
  }

  private normalizeRequiredImageUrl(value: string | null | undefined): string {
    if (typeof value !== 'string') {
      throw this.invalidImageUrlException();
    }

    const normalized = value.trim();

    if (!normalized || normalized.length > 1000) {
      throw this.invalidImageUrlException();
    }

    try {
      const url = new URL(normalized);

      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch {
      throw this.invalidImageUrlException();
    }

    return normalized;
  }

  private normalizeOptionalText(
    value: string | null | undefined,
    maxLength: number,
    fieldName: string,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw this.invalidFieldException(fieldName);
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      return null;
    }

    if (
      normalized.length > maxLength ||
      /<[^>]*>|javascript\s*:/i.test(normalized)
    ) {
      throw this.invalidFieldException(fieldName);
    }

    return normalized;
  }

  private normalizeSortOrder(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw this.invalidFieldException('sortOrder');
    }

    return value;
  }

  private normalizeBoolean(value: boolean | null | undefined, fieldName: string) {
    if (typeof value !== 'boolean') {
      throw this.invalidFieldException(fieldName);
    }

    return value;
  }

  private imageNotFoundException() {
    return new NotFoundException({
      code: 'LANDING_GALLERY_IMAGE_NOT_FOUND',
      message: 'Landing gallery image was not found.',
    });
  }

  private imageLimitExceededException() {
    return new ConflictException({
      code: 'LANDING_GALLERY_IMAGE_LIMIT_EXCEEDED',
      message: 'Up to 10 landing gallery images can be managed.',
    });
  }

  private invalidImageUrlException() {
    return new BadRequestException({
      code: 'LANDING_GALLERY_IMAGE_URL_INVALID',
      message: 'Image URL must be a valid public HTTP or HTTPS URL.',
    });
  }

  private invalidFieldException(fieldName: string) {
    return new BadRequestException({
      code: 'LANDING_GALLERY_FIELD_INVALID',
      message: `${fieldName} is invalid.`,
    });
  }
}
