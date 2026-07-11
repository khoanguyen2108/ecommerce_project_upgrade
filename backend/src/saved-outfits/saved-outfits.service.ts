import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateSavedOutfitDto,
  SavedOutfitItemSnapshotDto,
} from './dto/create-saved-outfit.dto';

const MAX_SAVED_OUTFITS_PER_LIST = 50;
const MAX_DATABASE_INTEGER = 2_147_483_647;

export const savedOutfitResponseSelect = {
  id: true,
  sourcePrompt: true,
  locale: true,
  summary: true,
  totalPriceSnapshot: true,
  items: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.SavedOutfitSelect;

@Injectable()
export class SavedOutfitsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateSavedOutfitDto) {
    this.assertUniqueItems(dto.items);
    const items = this.toJsonSnapshots(dto.items);
    const totalPriceSnapshot = this.computeTotal(items);

    await this.assertProductsAndVariantsAvailable(dto.items);

    const savedOutfit = await this.prismaService.savedOutfit.create({
      data: {
        userId: user.id,
        sourcePrompt: dto.sourcePrompt,
        locale: dto.locale,
        summary: dto.summary,
        totalPriceSnapshot,
        items,
      },
      select: savedOutfitResponseSelect,
    });

    return { savedOutfit };
  }

  async list(user: AuthenticatedUser) {
    const savedOutfits = await this.prismaService.savedOutfit.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_SAVED_OUTFITS_PER_LIST,
      select: savedOutfitResponseSelect,
    });

    return { savedOutfits };
  }

  async get(user: AuthenticatedUser, id: string) {
    const savedOutfit = await this.prismaService.savedOutfit.findFirst({
      where: { id, userId: user.id },
      select: savedOutfitResponseSelect,
    });

    if (!savedOutfit) {
      throw this.notFoundException();
    }

    return { savedOutfit };
  }

  async remove(user: AuthenticatedUser, id: string) {
    const result = await this.prismaService.savedOutfit.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count !== 1) {
      throw this.notFoundException();
    }

    return { deleted: true, id };
  }

  private assertUniqueItems(items: SavedOutfitItemSnapshotDto[]) {
    const roles = new Set<string>();
    const productIds = new Set<string>();

    for (const item of items) {
      if (roles.has(item.role)) {
        throw new BadRequestException({
          code: 'SAVED_OUTFIT_DUPLICATE_ROLE',
          message: 'A saved outfit cannot contain duplicate item roles.',
        });
      }

      if (productIds.has(item.productId)) {
        throw new BadRequestException({
          code: 'SAVED_OUTFIT_DUPLICATE_PRODUCT',
          message: 'A saved outfit cannot contain the same product twice.',
        });
      }

      roles.add(item.role);
      productIds.add(item.productId);
    }
  }

  private async assertProductsAndVariantsAvailable(
    items: SavedOutfitItemSnapshotDto[],
  ) {
    const productIds = items.map((item) => item.productId);
    const products = await this.prismaService.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        isActive: true,
        category: {
          select: { isActive: true },
        },
        variants: {
          where: {
            isActive: true,
            stock: { gt: 0 },
          },
          select: { id: true },
        },
      },
    });
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const unavailableProductIds = productIds.filter((productId) => {
      const product = productsById.get(productId);

      return (
        !product ||
        !product.isActive ||
        !product.category.isActive ||
        product.variants.length === 0
      );
    });

    if (unavailableProductIds.length > 0) {
      throw new BadRequestException({
        code: 'SAVED_OUTFIT_PRODUCT_UNAVAILABLE',
        message: 'One or more products are currently unavailable.',
        details: { productIds: unavailableProductIds },
      });
    }

    const unavailableVariantIds = items.flatMap((item) => {
      if (!item.variantId) {
        return [];
      }

      const product = productsById.get(item.productId);
      const isAvailable = product?.variants.some(
        (variant) => variant.id === item.variantId,
      );

      return isAvailable ? [] : [item.variantId];
    });

    if (unavailableVariantIds.length > 0) {
      throw new BadRequestException({
        code: 'SAVED_OUTFIT_VARIANT_UNAVAILABLE',
        message: 'One or more selected variants are currently unavailable.',
        details: { variantIds: unavailableVariantIds },
      });
    }
  }

  private toJsonSnapshots(items: SavedOutfitItemSnapshotDto[]) {
    return items.map((item) => ({
      role: item.role,
      productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      productNameSnapshot: item.productNameSnapshot,
      productSlugSnapshot: item.productSlugSnapshot,
      ...(item.imageUrlSnapshot
        ? { imageUrlSnapshot: item.imageUrlSnapshot }
        : {}),
      unitPriceSnapshot: item.unitPriceSnapshot,
      quantity: item.quantity,
    })) satisfies Prisma.InputJsonObject[];
  }

  private computeTotal(
    items: Array<{ unitPriceSnapshot: number; quantity: number }>,
  ) {
    const total = items.reduce(
      (sum, item) => sum + item.unitPriceSnapshot * item.quantity,
      0,
    );

    if (!Number.isSafeInteger(total) || total > MAX_DATABASE_INTEGER) {
      throw new BadRequestException({
        code: 'SAVED_OUTFIT_TOTAL_INVALID',
        message: 'Saved outfit total is outside the supported range.',
      });
    }

    return total;
  }

  private notFoundException() {
    return new NotFoundException({
      code: 'SAVED_OUTFIT_NOT_FOUND',
      message: 'Saved outfit was not found.',
    });
  }
}
