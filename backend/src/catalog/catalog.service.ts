import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetService,
  type ProductImageUpload,
} from '../assets/asset.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_PRODUCT_VARIANTS,
  PRODUCT_VARIANT_LIMIT_MESSAGE,
} from './catalog.constants';
import type {
  AdminCategoryOrder,
  AdminCategoryQueryDto,
  AdminCategorySort,
} from './dto/admin-category-query.dto';
import type {
  AdminProductOrder,
  AdminProductQueryDto,
  AdminProductSort,
} from './dto/admin-product-query.dto';
import type {
  AdminProductVariantQueryDto,
  AdminVariantOrder,
  AdminVariantSort,
} from './dto/admin-product-variant-query.dto';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { CreateProductVariantDto } from './dto/create-product-variant.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type {
  ProductQueryDto,
  ProductSort,
} from './dto/product-query.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';
import type { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

const DEFAULT_PRODUCT_LIMIT = 20;
const MAX_PRODUCT_LIMIT = 50;
const DEFAULT_ADMIN_LIST_LIMIT = 20;
const MAX_ADMIN_LIST_LIMIT = 100;
const LOW_STOCK_THRESHOLD = 5;

const categorySelect: Prisma.CategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  isFeatured: true,
  featuredOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const featuredCategorySelect: Prisma.CategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  featuredOrder: true,
};

const categorySummarySelect: Prisma.CategorySelect = {
  id: true,
  name: true,
  slug: true,
};

const variantSelect: Prisma.ProductVariantSelect = {
  id: true,
  productId: true,
  sku: true,
  size: true,
  color: true,
  stock: true,
  priceOverride: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const variantOrderBy: Prisma.ProductVariantOrderByWithRelationInput[] = [
  { size: 'asc' },
  { color: 'asc' },
];

const managedProductImageSelect = {
  id: true,
  sortOrder: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
  imageAsset: {
    select: {
      id: true,
      provider: true,
      bucket: true,
      storagePath: true,
      publicUrl: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      width: true,
      height: true,
      checksum: true,
      uploadedById: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ProductImageSelect;

const productSelect = {
  id: true,
  categoryId: true,
  name: true,
  slug: true,
  description: true,
  basePrice: true,
  imageUrls: true,
  managedImages: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: managedProductImageSelect,
  },
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: categorySummarySelect,
  },
  productCategories: {
    select: {
      category: {
        select: categorySummarySelect,
      },
    },
  },
  variants: {
    select: variantSelect,
    orderBy: variantOrderBy,
  },
} satisfies Prisma.ProductSelect;

const publicProductSelect = {
  ...productSelect,
  productCategories: {
    where: {
      category: {
        isActive: true,
      },
    },
    select: {
      category: {
        select: categorySummarySelect,
      },
    },
  },
  variants: {
    where: {
      isActive: true,
    },
    select: variantSelect,
    orderBy: variantOrderBy,
  },
} satisfies Prisma.ProductSelect;

function serializeProduct<
  T extends {
    category: { id: string; name: string; slug: string };
    imageUrls: string[];
    managedImages: Array<{
      id: string;
      sortOrder: number;
      isPrimary: boolean;
      createdAt: Date;
      updatedAt: Date;
      imageAsset: {
        id: string;
        provider: string;
        bucket: string;
        storagePath: string;
        publicUrl: string;
        originalFilename: string | null;
        mimeType: string;
        sizeBytes: number;
        width: number | null;
        height: number | null;
        checksum: string | null;
        uploadedById: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    productCategories: Array<{
      category: { id: string; name: string; slug: string };
    }>;
  },
>(product: T, includeManagedMetadata = false) {
  const {
    productCategories,
    managedImages: productImages,
    imageUrls: legacyImageUrls,
    ...productData
  } = product;
  const secondaryCategories = productCategories
    .map((membership) => membership.category)
    .filter((category) => category.id !== product.category.id)
    .sort((first, second) => first.name.localeCompare(second.name));
  const managedImages = productImages.map(({ imageAsset, ...productImage }) => ({
    ...productImage,
    assetId: imageAsset.id,
    url: imageAsset.publicUrl,
    provider: imageAsset.provider,
    bucket: imageAsset.bucket,
    storagePath: imageAsset.storagePath,
    originalFilename: imageAsset.originalFilename,
    mimeType: imageAsset.mimeType,
    sizeBytes: imageAsset.sizeBytes,
    width: imageAsset.width,
    height: imageAsset.height,
    checksum: imageAsset.checksum,
    uploadedById: imageAsset.uploadedById,
    status: imageAsset.status,
    assetCreatedAt: imageAsset.createdAt,
    assetUpdatedAt: imageAsset.updatedAt,
  }));

  return {
    ...productData,
    imageUrls:
      managedImages.length > 0
        ? managedImages.map((image) => image.url)
        : legacyImageUrls,
    ...(includeManagedMetadata ? { managedImages } : {}),
    categories: [product.category, ...secondaryCategories],
  };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly assetService: AssetService,
  ) {}

  async listCategories() {
    const categories = await this.prismaService.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
      select: categorySelect,
    });

    return { categories };
  }

  async listFeaturedCategories() {
    const categories = await this.prismaService.category.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      orderBy: [{ featuredOrder: 'asc' }, { createdAt: 'asc' }],
      take: 3,
      select: featuredCategorySelect,
    });

    return { categories };
  }

  async listAdminCategories(query: AdminCategoryQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? DEFAULT_ADMIN_LIST_LIMIT,
      MAX_ADMIN_LIST_LIMIT,
    );
    const where = this.buildAdminCategoryWhere(query);

    const [total, categories] = await this.prismaService.$transaction([
      this.prismaService.category.count({ where }),
      this.prismaService.category.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.getCategoryOrderBy(query.sort, query.order),
        select: categorySelect,
      }),
    ]);

    return {
      categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getPublicCategory(id: string) {
    const category = await this.prismaService.category.findFirst({
      where: {
        id,
        isActive: true,
      },
      select: categorySelect,
    });

    if (!category) {
      throw this.categoryNotFoundException();
    }

    return { category };
  }

  async getAdminCategory(id: string) {
    const category = await this.prismaService.category.findUnique({
      where: {
        id,
      },
      select: categorySelect,
    });

    if (!category) {
      throw this.adminCategoryNotFoundException();
    }

    return { category };
  }

  async getPublicCategoryBySlug(slug: string) {
    const category = await this.prismaService.category.findFirst({
      where: {
        slug: this.normalizeSlug(slug),
        isActive: true,
      },
      select: categorySelect,
    });

    if (!category) {
      throw this.categoryNotFoundException();
    }

    return { category };
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = this.normalizeSlug(dto.slug);
    const isActive = this.normalizeOptionalBoolean(
      dto.isActive,
      true,
      'isActive',
    );
    const isFeatured = isActive
      ? this.normalizeOptionalBoolean(dto.isFeatured, false, 'isFeatured')
      : false;
    const featuredOrder = this.normalizeFeaturedOrder(
      isFeatured,
      dto.featuredOrder,
    );
    await this.assertCategorySlugAvailable(slug);
    await this.assertFeaturedCategoryAvailable(
      undefined,
      isFeatured,
      featuredOrder,
    );

    try {
      const category = await this.prismaService.category.create({
        data: {
          name: this.normalizeRequiredText(dto.name, 'name'),
          slug,
          description: this.normalizeOptionalText(dto.description),
          imageUrl: this.normalizeCategoryImageUrl(dto.imageUrl),
          isFeatured,
          featuredOrder,
          isActive,
        },
        select: categorySelect,
      });

      return { category };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        if (this.getUniqueConstraintTarget(error).includes('featuredOrder')) {
          throw this.featuredOrderConflictException();
        }

        throw this.categorySlugExistsException();
      }

      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const existingCategory = await this.getCategoryForAdmin(id);

    const data: Prisma.CategoryUpdateInput = {};

    if ('name' in dto) {
      data.name = this.normalizeRequiredText(dto.name, 'name');
    }

    if ('slug' in dto) {
      const slug = this.normalizeSlug(dto.slug);
      await this.assertCategorySlugAvailable(slug, id);
      data.slug = slug;
    }

    if ('description' in dto) {
      data.description = this.normalizeOptionalText(dto.description);
    }

    if ('imageUrl' in dto) {
      data.imageUrl = this.normalizeCategoryImageUrl(dto.imageUrl);
    }

    if ('isActive' in dto) {
      data.isActive = this.normalizeOptionalBoolean(
        dto.isActive,
        undefined,
        'isActive',
      );
    }

    const nextIsActive =
      typeof data.isActive === 'boolean'
        ? data.isActive
        : existingCategory.isActive;
    const explicitlyFeatured = 'isFeatured' in dto;
    const nextIsFeatured = nextIsActive
      ? explicitlyFeatured
        ? this.normalizeOptionalBoolean(dto.isFeatured, undefined, 'isFeatured')
        : existingCategory.isFeatured
      : false;
    const nextFeaturedOrder = nextIsFeatured
      ? 'featuredOrder' in dto
        ? this.normalizeFeaturedOrder(true, dto.featuredOrder)
        : explicitlyFeatured
          ? this.normalizeFeaturedOrder(true, undefined)
          : existingCategory.featuredOrder
      : null;

    if ('isFeatured' in dto || 'featuredOrder' in dto || !nextIsActive) {
      data.isFeatured = nextIsFeatured;
      data.featuredOrder = nextFeaturedOrder;
    }

    await this.assertFeaturedCategoryAvailable(
      id,
      nextIsFeatured,
      nextFeaturedOrder,
    );

    this.assertUpdateHasFields(data, 'CATEGORY_UPDATE_EMPTY');

    try {
      const category = await this.prismaService.category.update({
        where: {
          id,
        },
        data,
        select: categorySelect,
      });

      return { category };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        if (this.getUniqueConstraintTarget(error).includes('featuredOrder')) {
          throw this.featuredOrderConflictException();
        }

        throw this.categorySlugExistsException();
      }

      throw error;
    }
  }

  async deactivateCategory(id: string) {
    await this.getCategoryForAdmin(id);

    const category = await this.prismaService.category.update({
      where: {
        id,
      },
      data: {
        isActive: false,
        isFeatured: false,
        featuredOrder: null,
      },
      select: categorySelect,
    });

    return { category };
  }

  async activateCategory(id: string) {
    await this.getCategoryForAdmin(id);

    const category = await this.prismaService.category.update({
      where: { id },
      data: { isActive: true },
      select: categorySelect,
    });

    return { category };
  }

  async deleteCategory(id: string) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: {
            primaryProducts: true,
            productCategories: true,
          },
        },
      },
    });

    if (!category) {
      throw this.adminCategoryNotFoundException();
    }

    if (
      category._count.primaryProducts > 0 ||
      category._count.productCategories > 0
    ) {
      throw new ConflictException({
        code: 'CATEGORY_DELETE_BLOCKED',
        message: 'This category has products. Move or remove products before deleting.',
      });
    }

    await this.prismaService.category.delete({ where: { id } });
    return { deletedId: id };
  }

  async listProducts(query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? DEFAULT_PRODUCT_LIMIT, MAX_PRODUCT_LIMIT);
    const where = this.buildPublicProductWhere(query);

    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException({
        code: 'INVALID_PRICE_RANGE',
        message: 'minPrice must be less than or equal to maxPrice.',
      });
    }

    const [total, products] = await this.prismaService.$transaction([
      this.prismaService.product.count({ where }),
      this.prismaService.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.getProductOrderBy(query.sort),
        select: publicProductSelect,
      }),
    ]);

    return {
      products: products.map((product) => serializeProduct(product)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listAdminProducts(query: AdminProductQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? DEFAULT_ADMIN_LIST_LIMIT,
      MAX_ADMIN_LIST_LIMIT,
    );

    this.assertPriceRangeIsValid(query.minPrice, query.maxPrice);

    const where = this.buildAdminProductWhere(query);
    const [total, products] = await this.prismaService.$transaction([
      this.prismaService.product.count({ where }),
      this.prismaService.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.getAdminProductOrderBy(query.sort, query.order),
        select: productSelect,
      }),
    ]);

    return {
      products: products.map((product) => serializeProduct(product, true)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getPublicProduct(id: string) {
    const product = await this.prismaService.product.findFirst({
      where: {
        id,
        isActive: true,
        category: {
          isActive: true,
        },
      },
      select: publicProductSelect,
    });

    if (!product) {
      throw this.productNotFoundException();
    }

    return { product: serializeProduct(product) };
  }

  async getAdminProduct(id: string) {
    const product = await this.prismaService.product.findUnique({
      where: {
        id,
      },
      select: productSelect,
    });

    if (!product) {
      throw this.productNotFoundException();
    }

    return { product: serializeProduct(product, true) };
  }

  async getPublicProductBySlug(slug: string) {
    const product = await this.prismaService.product.findFirst({
      where: {
        slug: this.normalizeSlug(slug),
        isActive: true,
        category: {
          isActive: true,
        },
      },
      select: publicProductSelect,
    });

    if (!product) {
      throw this.productNotFoundException();
    }

    return { product: serializeProduct(product) };
  }

  async getPublicProductVariants(id: string) {
    const product = await this.prismaService.product.findFirst({
      where: {
        id,
        isActive: true,
        category: {
          isActive: true,
        },
      },
      select: {
        id: true,
        variants: {
          where: {
            isActive: true,
          },
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
          select: variantSelect,
        },
      },
    });

    if (!product) {
      throw this.productNotFoundException();
    }

    return { variants: product.variants };
  }

  async listAdminProductVariants(
    productId: string,
    query: AdminProductVariantQueryDto,
  ) {
    await this.getProductForAdmin(productId);

    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? DEFAULT_ADMIN_LIST_LIMIT,
      MAX_ADMIN_LIST_LIMIT,
    );
    const where = this.buildAdminVariantWhere(productId, query);

    const [total, variants] = await this.prismaService.$transaction([
      this.prismaService.productVariant.count({ where }),
      this.prismaService.productVariant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.getAdminVariantOrderBy(query.sort, query.order),
        select: variantSelect,
      }),
    ]);

    return {
      variants,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getAdminProductVariant(id: string) {
    const variant = await this.prismaService.productVariant.findUnique({
      where: {
        id,
      },
      select: variantSelect,
    });

    if (!variant) {
      throw this.productVariantNotFoundException();
    }

    return { variant };
  }

  async getPublicProductVariantsBySlug(slug: string) {
    const product = await this.prismaService.product.findFirst({
      where: {
        slug: this.normalizeSlug(slug),
        isActive: true,
        category: {
          isActive: true,
        },
      },
      select: {
        id: true,
        variants: {
          where: {
            isActive: true,
          },
          orderBy: variantOrderBy,
          select: variantSelect,
        },
      },
    });

    if (!product) {
      throw this.productNotFoundException();
    }

    return { variants: product.variants };
  }

  async createProduct(dto: CreateProductDto) {
    const slug = this.normalizeSlug(dto.slug);
    const requestedLegacyImageUrls = this.normalizeImageUrls(dto.imageUrls);
    if (requestedLegacyImageUrls.length > 0) {
      throw this.productImageUrlInputDisabledException();
    }
    const categoryIds = this.normalizeCategoryIds(dto.categoryIds, dto.categoryId);
    await this.assertActiveCategoriesExist(categoryIds);
    await this.assertProductSlugAvailable(slug);
    this.assertVariantLimit(dto.variants?.length ?? 0);
    const variants = (dto.variants ?? []).map((variant) => ({
      sku: this.normalizeOptionalSku(variant.sku),
      size: this.normalizeSize(variant.size),
      color: this.normalizeColor(variant.color),
      stock: variant.stock,
      priceOverride: variant.priceOverride ?? null,
      isActive: this.normalizeOptionalBoolean(
        variant.isActive,
        true,
        'isActive',
      ),
    }));
    this.assertDraftVariantsAreUnique(variants);
    await Promise.all(variants.map((variant) => this.assertSkuAvailable(variant.sku)));

    try {
      const product = await this.prismaService.product.create({
        data: {
          category: {
            connect: {
              id: categoryIds[0],
            },
          },
          productCategories: {
            create: categoryIds.map((categoryId) => ({
              category: {
                connect: {
                  id: categoryId,
                },
              },
            })),
          },
          name: this.normalizeRequiredText(dto.name, 'name'),
          slug,
          description: this.normalizeOptionalText(dto.description),
          basePrice: dto.basePrice,
          imageUrls: [],
          isActive: this.normalizeOptionalBoolean(dto.isActive, true, 'isActive'),
          ...(variants.length > 0
            ? {
                variants: {
                  create: variants,
                },
              }
            : {}),
        },
        select: productSelect,
      });

      return { product: serializeProduct(product, true) };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const target = this.getUniqueConstraintTarget(error);
        if (target.includes('slug')) {
          throw this.productSlugExistsException();
        }
        throw this.variantUniqueConflictException(error);
      }

      throw error;
    }
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const existingProduct = await this.getProductForAdmin(id);

    const data: Prisma.ProductUpdateInput = {};

    if ('categoryIds' in dto || 'categoryId' in dto) {
      const categoryIds = this.normalizeCategoryIds(
        dto.categoryIds,
        dto.categoryId,
      );
      await this.assertActiveCategoriesExist(categoryIds);
      data.category = {
        connect: {
          id: categoryIds[0],
        },
      };
      data.productCategories = {
        deleteMany: {},
        create: categoryIds.map((categoryId) => ({
          category: {
            connect: {
              id: categoryId,
            },
          },
        })),
      };
    }

    if ('name' in dto) {
      data.name = this.normalizeRequiredText(dto.name, 'name');
    }

    if ('slug' in dto) {
      const slug = this.normalizeSlug(dto.slug);
      await this.assertProductSlugAvailable(slug, id);
      data.slug = slug;
    }

    if ('description' in dto) {
      data.description = this.normalizeOptionalText(dto.description);
    }

    if ('basePrice' in dto) {
      data.basePrice = this.normalizeRequiredNumber(dto.basePrice, 'basePrice');
    }

    if ('imageUrls' in dto) {
      const managedImages = await this.prismaService.productImage.findMany({
        where: { productId: id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { imageAsset: { select: { publicUrl: true } } },
      });
      data.imageUrls =
        managedImages.length > 0
          ? managedImages.map((image) => image.imageAsset.publicUrl)
          : this.normalizeLegacyImageUrlSelection(
              dto.imageUrls,
              existingProduct.imageUrls,
            );
    }

    if ('isActive' in dto) {
      data.isActive = this.normalizeOptionalBoolean(
        dto.isActive,
        undefined,
        'isActive',
      );
    }

    this.assertUpdateHasFields(data, 'PRODUCT_UPDATE_EMPTY');

    try {
      const product = await this.prismaService.product.update({
        where: {
          id,
        },
        data,
        select: productSelect,
      });

      return { product: serializeProduct(product, true) };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.productSlugExistsException();
      }

      throw error;
    }
  }

  async uploadProductImage(
    productId: string,
    uploadedById: string,
    file: ProductImageUpload | undefined,
  ) {
    const uploadedImage = await this.assetService.uploadProductImage(
      productId,
      uploadedById,
      file,
    );
    const { product } = await this.getAdminProduct(productId);

    return { product, uploadedImageId: uploadedImage.id };
  }

  async deleteProductImage(productId: string, productImageId: string) {
    const deletion = await this.assetService.deleteProductImage(
      productId,
      productImageId,
    );
    const { product } = await this.getAdminProduct(productId);

    return { product, ...deletion };
  }

  async reorderProductImages(productId: string, productImageIds: string[]) {
    await this.assetService.reorderProductImages(productId, productImageIds);
    return this.getAdminProduct(productId);
  }

  async deactivateProduct(id: string) {
    await this.getProductForAdmin(id);

    const product = await this.prismaService.product.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
      select: productSelect,
    });

    return { product: serializeProduct(product, true) };
  }

  async activateProduct(id: string) {
    await this.getProductForAdmin(id);

    const product = await this.prismaService.product.update({
      where: { id },
      data: { isActive: true },
      select: productSelect,
    });

    return { product: serializeProduct(product, true) };
  }

  async deleteProduct(id: string) {
    const product = await this.prismaService.product.findUnique({
      where: { id },
      select: {
        id: true,
        managedImages: { select: { id: true } },
        orderItems: { select: { id: true }, take: 1 },
        variants: {
          select: {
            cartItems: { select: { id: true }, take: 1 },
            orderItems: { select: { id: true }, take: 1 },
          },
        },
      },
    });

    if (!product) {
      throw this.productNotFoundException();
    }

    const isReferenced =
      product.orderItems.length > 0 ||
      product.variants.some(
        (variant) =>
          variant.orderItems.length > 0 || variant.cartItems.length > 0,
      );

    if (isReferenced) {
      throw new ConflictException({
        code: 'PRODUCT_DELETE_BLOCKED',
        message:
          'This product cannot be deleted because related orders or carts exist. Deactivate the product instead.',
      });
    }

    const cleanupWarnings: string[] = [];
    for (const image of product.managedImages) {
      const result = await this.assetService.deleteProductImage(id, image.id);
      if (result.warning) {
        cleanupWarnings.push(result.warning);
      }
    }

    await this.prismaService.$transaction([
      this.prismaService.productVariant.deleteMany({ where: { productId: id } }),
      this.prismaService.product.delete({ where: { id } }),
    ]);

    return {
      deletedId: id,
      warning:
        cleanupWarnings.length > 0 ? cleanupWarnings.join(' ') : undefined,
    };
  }

  async createProductVariant(productId: string, dto: CreateProductVariantDto) {
    await this.getProductForAdmin(productId);
    await this.assertProductVariantCapacity(productId);

    const sku = this.normalizeOptionalSku(dto.sku);
    const size = this.normalizeSize(dto.size);
    const color = this.normalizeColor(dto.color);

    await this.assertSkuAvailable(sku);
    await this.assertVariantOptionAvailable(productId, size, color);

    try {
      const variant = await this.prismaService.productVariant.create({
        data: {
          productId,
          sku,
          size,
          color,
          stock: dto.stock,
          priceOverride: dto.priceOverride ?? null,
          isActive: this.normalizeOptionalBoolean(dto.isActive, true, 'isActive'),
        },
        select: variantSelect,
      });

      return { variant };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.variantUniqueConflictException(error);
      }

      throw error;
    }
  }

  async updateProductVariant(id: string, dto: UpdateProductVariantDto) {
    const currentVariant = await this.getProductVariantForAdmin(id);
    const data: Prisma.ProductVariantUpdateInput = {};

    if ('sku' in dto) {
      const sku = this.normalizeOptionalSku(dto.sku);
      await this.assertSkuAvailable(sku, id);
      data.sku = sku;
    }

    const nextSize =
      'size' in dto ? this.normalizeSize(dto.size) : currentVariant.size;
    const nextColor =
      'color' in dto ? this.normalizeColor(dto.color) : currentVariant.color;

    if (nextSize !== currentVariant.size || nextColor !== currentVariant.color) {
      await this.assertVariantOptionAvailable(
        currentVariant.productId,
        nextSize,
        nextColor,
        id,
      );
    }

    if ('size' in dto) {
      data.size = nextSize;
    }

    if ('color' in dto) {
      data.color = nextColor;
    }

    if ('stock' in dto) {
      data.stock = this.normalizeRequiredNumber(dto.stock, 'stock');
    }

    if ('priceOverride' in dto) {
      data.priceOverride = dto.priceOverride ?? null;
    }

    if ('isActive' in dto) {
      data.isActive = this.normalizeOptionalBoolean(
        dto.isActive,
        undefined,
        'isActive',
      );
    }

    this.assertUpdateHasFields(data, 'PRODUCT_VARIANT_UPDATE_EMPTY');

    try {
      const variant = await this.prismaService.productVariant.update({
        where: {
          id,
        },
        data,
        select: variantSelect,
      });

      return { variant };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.variantUniqueConflictException(error);
      }

      throw error;
    }
  }

  async deactivateProductVariant(id: string) {
    await this.getProductVariantForAdmin(id);

    const variant = await this.prismaService.productVariant.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
      select: variantSelect,
    });

    return { variant };
  }

  private buildAdminCategoryWhere(
    query: AdminCategoryQueryDto,
  ): Prisma.CategoryWhereInput {
    const where: Prisma.CategoryWhereInput = {};
    const search = this.normalizeOptionalQueryText(query.search);

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          slug: {
            contains: this.normalizeSlugForSearch(search) ?? search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    return where;
  }

  private buildAdminProductWhere(
    query: AdminProductQueryDto,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};
    const search = this.normalizeOptionalQueryText(query.search);

    if (search) {
      const slugSearch = this.normalizeSlugForSearch(search);

      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          slug: {
            contains: slugSearch ?? search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.categoryId) {
      where.productCategories = {
        some: {
          categoryId: query.categoryId,
        },
      };
    }

    if (query.categorySlug) {
      where.productCategories = {
        some: {
          category: {
            slug: this.normalizeSlug(query.categorySlug),
          },
        },
      };
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    return where;
  }

  private buildAdminVariantWhere(
    productId: string,
    query: AdminProductVariantQueryDto,
  ): Prisma.ProductVariantWhereInput {
    const where: Prisma.ProductVariantWhereInput = {
      productId,
    };

    const sku = this.normalizeOptionalQueryText(query.sku);
    const size = this.normalizeOptionalQueryText(query.size);
    const color = this.normalizeOptionalQueryText(query.color);

    if (sku) {
      where.sku = {
        contains: sku.replace(/\s+/g, '').toUpperCase(),
        mode: 'insensitive',
      };
    }

    if (size) {
      where.size = {
        equals: this.normalizeSize(size),
        mode: 'insensitive',
      };
    }

    if (color) {
      where.color = {
        contains: this.normalizeColor(color),
        mode: 'insensitive',
      };
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.stockStatus === 'in_stock') {
      where.stock = {
        gt: 0,
      };
    }

    if (query.stockStatus === 'low_stock') {
      where.stock = {
        gt: 0,
        lte: LOW_STOCK_THRESHOLD,
      };
    }

    if (query.stockStatus === 'out_of_stock') {
      where.stock = 0;
    }

    return where;
  }

  private buildPublicProductWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      category: {
        isActive: true,
      },
    };
    const search = this.normalizeOptionalQueryText(query.search);

    if (search) {
      const searchFilters: Prisma.ProductWhereInput[] = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
      const slugSearch = this.normalizeSlugForSearch(search);

      if (slugSearch) {
        searchFilters.push({
          slug: {
            contains: slugSearch,
            mode: 'insensitive',
          },
        });
      }

      where.OR = searchFilters;
    }

    if (query.categoryId) {
      where.productCategories = {
        some: {
          categoryId: query.categoryId,
          category: {
            isActive: true,
          },
        },
      };
    }

    if (query.categorySlug) {
      where.productCategories = {
        some: {
          category: {
            isActive: true,
            slug: this.normalizeSlug(query.categorySlug),
          },
        },
      };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    const size = this.normalizeOptionalQueryText(query.size);
    const color = this.normalizeOptionalQueryText(query.color);

    if (size || color) {
      where.variants = {
        some: {
          isActive: true,
          ...(size
            ? {
                size: {
                  equals: this.normalizeSize(size),
                  mode: 'insensitive',
                },
              }
            : {}),
          ...(color
            ? {
                color: {
                  equals: this.normalizeColor(color),
                  mode: 'insensitive',
                },
              }
            : {}),
        },
      };
    }

    return where;
  }

  private getCategoryOrderBy(
    sort: AdminCategorySort = 'createdAt',
    order: AdminCategoryOrder = 'desc',
  ): Prisma.CategoryOrderByWithRelationInput[] {
    return [{ [sort]: order }, { id: 'asc' }];
  }

  private getAdminProductOrderBy(
    sort: AdminProductSort = 'createdAt',
    order: AdminProductOrder = 'desc',
  ): Prisma.ProductOrderByWithRelationInput[] {
    return [{ [sort]: order }, { id: 'asc' }];
  }

  private getAdminVariantOrderBy(
    sort: AdminVariantSort = 'createdAt',
    order: AdminVariantOrder = 'desc',
  ): Prisma.ProductVariantOrderByWithRelationInput[] {
    return [{ [sort]: order }, { id: 'asc' }];
  }

  private getProductOrderBy(
    sort: ProductSort = 'newest',
  ): Prisma.ProductOrderByWithRelationInput[] {
    if (sort === 'price_asc') {
      return [{ basePrice: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];
    }

    if (sort === 'price_desc') {
      return [{ basePrice: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
    }

    return [{ createdAt: 'desc' }, { id: 'asc' }];
  }

  private assertPriceRangeIsValid(
    minPrice: number | undefined,
    maxPrice: number | undefined,
  ) {
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException({
        code: 'INVALID_PRICE_RANGE',
        message: 'minPrice must be less than or equal to maxPrice.',
      });
    }
  }

  private async getCategoryForAdmin(id: string) {
    const category = await this.prismaService.category.findUnique({
      where: {
        id,
      },
      select: {
        featuredOrder: true,
        id: true,
        isActive: true,
        isFeatured: true,
        slug: true,
      },
    });

    if (!category) {
      throw this.adminCategoryNotFoundException();
    }

    return category;
  }

  private async getProductForAdmin(id: string) {
    const product = await this.prismaService.product.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        imageUrls: true,
        slug: true,
      },
    });

    if (!product) {
      throw this.productNotFoundException();
    }

    return product;
  }

  private async getProductVariantForAdmin(id: string) {
    const variant = await this.prismaService.productVariant.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        size: true,
        color: true,
      },
    });

    if (!variant) {
      throw this.productVariantNotFoundException();
    }

    return variant;
  }

  private async assertActiveCategoriesExist(categoryIds: string[]) {
    const categories = await this.prismaService.category.findMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (categories.length !== categoryIds.length) {
      throw this.categoryNotFoundException();
    }

    if (categories.some((category) => !category.isActive)) {
      throw new BadRequestException({
        code: 'CATEGORY_INACTIVE',
        message: 'Product category must be active.',
      });
    }
  }

  private async assertCategorySlugAvailable(slug: string, excludeId?: string) {
    const category = await this.prismaService.category.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (category && category.id !== excludeId) {
      throw this.categorySlugExistsException();
    }
  }

  private async assertProductSlugAvailable(slug: string, excludeId?: string) {
    const product = await this.prismaService.product.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (product && product.id !== excludeId) {
      throw this.productSlugExistsException();
    }
  }

  private async assertSkuAvailable(sku: string | null, excludeId?: string) {
    if (!sku) {
      return;
    }

    const variant = await this.prismaService.productVariant.findUnique({
      where: {
        sku,
      },
      select: {
        id: true,
      },
    });

    if (variant && variant.id !== excludeId) {
      throw this.skuExistsException();
    }
  }

  private async assertVariantOptionAvailable(
    productId: string,
    size: string,
    color: string,
    excludeId?: string,
  ) {
    const variant = await this.prismaService.productVariant.findFirst({
      where: {
        productId,
        size,
        color: {
          equals: color,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (variant && variant.id !== excludeId) {
      throw this.variantOptionExistsException();
    }
  }

  private assertDraftVariantsAreUnique(
    variants: Array<{ sku: string | null; size: string; color: string }>,
  ) {
    const combinations = new Set<string>();
    const skus = new Set<string>();

    for (const variant of variants) {
      const combination = `${variant.color.toLocaleLowerCase()}\u0000${variant.size}`;
      if (combinations.has(combination)) {
        throw this.variantOptionExistsException();
      }
      combinations.add(combination);

      if (variant.sku) {
        if (skus.has(variant.sku)) {
          throw this.skuExistsException();
        }
        skus.add(variant.sku);
      }
    }
  }

  private assertVariantLimit(nextVariantCount: number) {
    if (nextVariantCount > MAX_PRODUCT_VARIANTS) {
      throw this.productVariantLimitExceededException();
    }
  }

  private async assertProductVariantCapacity(productId: string) {
    const variantCount = await this.prismaService.productVariant.count({
      where: { productId },
    });

    this.assertVariantLimit(variantCount + 1);
  }

  private normalizeRequiredText(
    value: string | null | undefined,
    fieldName: string,
  ): string {
    if (typeof value !== 'string') {
      throw this.invalidFieldException(fieldName);
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      throw this.invalidFieldException(fieldName);
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw this.invalidFieldException('description');
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeSlug(value: string | null | undefined): string {
    if (typeof value !== 'string') {
      throw this.invalidFieldException('slug');
    }

    const slug = value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw this.invalidFieldException('slug');
    }

    return slug;
  }

  private normalizeSlugForSearch(value: string): string | undefined {
    const slug = value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug.length > 0 ? slug : undefined;
  }

  private normalizeImageUrls(value: string[] | null | undefined): string[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw this.invalidFieldException('imageUrls');
    }

    if (value.length > 4) {
      throw this.invalidFieldException('imageUrls');
    }

    return value.map((imageUrl) => {
      if (typeof imageUrl !== 'string') {
        throw this.invalidFieldException('imageUrls');
      }

      const normalized = imageUrl.trim();

      if (!normalized) {
        throw this.invalidFieldException('imageUrls');
      }

      return normalized;
    });
  }

  private normalizeLegacyImageUrlSelection(
    value: string[] | null | undefined,
    existingImageUrls: string[],
  ): string[] {
    const imageUrls = this.normalizeImageUrls(value);

    if (imageUrls.some((imageUrl) => !existingImageUrls.includes(imageUrl))) {
      throw this.productImageUrlInputDisabledException();
    }

    return imageUrls;
  }

  private normalizeCategoryIds(
    value: string[] | null | undefined,
    primaryCategoryId: string | null | undefined,
  ): string[] {
    const normalizedPrimary = primaryCategoryId
      ? this.normalizeRequiredId(primaryCategoryId, 'categoryId')
      : undefined;
    const sourceCategoryIds = Array.isArray(value)
      ? value
      : normalizedPrimary
        ? [normalizedPrimary]
        : [];
    const categoryIds = Array.from(
      new Set(
        sourceCategoryIds.map((categoryId) =>
          this.normalizeRequiredId(categoryId, 'categoryIds'),
        ),
      ),
    );

    if (categoryIds.length === 0) {
      throw this.invalidFieldException('categoryIds');
    }

    if (!normalizedPrimary) {
      return categoryIds;
    }

    return [
      normalizedPrimary,
      ...categoryIds.filter((categoryId) => categoryId !== normalizedPrimary),
    ];
  }

  private normalizeCategoryImageUrl(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw this.categoryImageUrlInvalidException();
    }

    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length > 2048) {
      throw this.categoryImageUrlInvalidException();
    }

    try {
      const url = new URL(normalized);

      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch {
      throw this.categoryImageUrlInvalidException();
    }

    return normalized;
  }

  private normalizeFeaturedOrder(
    isFeatured: boolean,
    value: number | null | undefined,
  ): number | null {
    if (!isFeatured) {
      return null;
    }

    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 3) {
      throw new BadRequestException({
        code: 'ADMIN_CATEGORY_FEATURED_ORDER_INVALID',
        message: 'Featured order must be 1, 2, or 3 for a featured category.',
      });
    }

    return value as number;
  }

  private async assertFeaturedCategoryAvailable(
    excludeId: string | undefined,
    isFeatured: boolean,
    featuredOrder: number | null,
  ) {
    if (!isFeatured || featuredOrder === null) {
      return;
    }

    const where: Prisma.CategoryWhereInput = {
      isActive: true,
      isFeatured: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    };
    const [featuredCount, orderConflict] = await this.prismaService.$transaction([
      this.prismaService.category.count({ where }),
      this.prismaService.category.findFirst({
        where: {
          ...where,
          featuredOrder,
        },
        select: { id: true },
      }),
    ]);

    if (featuredCount >= 3) {
      throw new ConflictException({
        code: 'ADMIN_CATEGORY_FEATURED_LIMIT_EXCEEDED',
        message: 'Up to 3 active categories can be featured on the landing page.',
      });
    }

    if (orderConflict) {
      throw this.featuredOrderConflictException();
    }
  }

  private normalizeOptionalSku(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw this.invalidFieldException('sku');
    }

    const normalized = value.trim().replace(/\s+/g, '').toUpperCase();

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeSize(value: string | null | undefined): string {
    return this.normalizeRequiredText(value, 'size').toUpperCase();
  }

  private normalizeColor(value: string | null | undefined): string {
    return this.normalizeRequiredText(value, 'color');
  }

  private normalizeOptionalQueryText(value: string | undefined): string | undefined {
    const normalized = value?.trim().replace(/\s+/g, ' ');

    return normalized ? normalized : undefined;
  }

  private normalizeRequiredId(
    value: string | null | undefined,
    fieldName: string,
  ): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw this.invalidFieldException(fieldName);
    }

    return value.trim();
  }

  private normalizeRequiredNumber(
    value: number | null | undefined,
    fieldName: string,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw this.invalidFieldException(fieldName);
    }

    return value;
  }

  private normalizeOptionalBoolean(
    value: boolean | null | undefined,
    defaultValue: boolean | undefined,
    fieldName: string,
  ): boolean {
    if (value === undefined) {
      if (defaultValue === undefined) {
        throw this.invalidFieldException(fieldName);
      }

      return defaultValue;
    }

    if (typeof value !== 'boolean') {
      throw this.invalidFieldException(fieldName);
    }

    return value;
  }

  private assertUpdateHasFields(data: object, code: string) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code,
        message: 'Provide at least one field to update.',
      });
    }
  }

  private invalidFieldException(fieldName: string) {
    return new BadRequestException({
      code: 'INVALID_CATALOG_FIELD',
      message: `${fieldName} is invalid.`,
    });
  }

  private categoryNotFoundException() {
    return new NotFoundException({
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category was not found.',
    });
  }

  private adminCategoryNotFoundException() {
    return new NotFoundException({
      code: 'ADMIN_CATEGORY_NOT_FOUND',
      message: 'Category was not found.',
    });
  }

  private categoryImageUrlInvalidException() {
    return new BadRequestException({
      code: 'ADMIN_CATEGORY_IMAGE_URL_INVALID',
      message: 'Image URL must be a valid public HTTP or HTTPS URL.',
    });
  }

  private featuredOrderConflictException() {
    return new ConflictException({
      code: 'ADMIN_CATEGORY_FEATURED_ORDER_CONFLICT',
      message: 'Another featured category already uses this display order.',
    });
  }

  private productNotFoundException() {
    return new NotFoundException({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product was not found.',
    });
  }

  private productImageUrlInputDisabledException() {
    return new BadRequestException({
      code: 'PRODUCT_IMAGE_URL_INPUT_DISABLED',
      message: 'New product images must be uploaded as JPEG, PNG, or WebP files.',
    });
  }

  private productVariantNotFoundException() {
    return new NotFoundException({
      code: 'PRODUCT_VARIANT_NOT_FOUND',
      message: 'Product variant was not found.',
    });
  }

  private categorySlugExistsException() {
    return new ConflictException({
      code: 'CATEGORY_SLUG_EXISTS',
      message: 'A category with this slug already exists.',
    });
  }

  private productSlugExistsException() {
    return new ConflictException({
      code: 'PRODUCT_SLUG_EXISTS',
      message: 'A product with this slug already exists.',
    });
  }

  private skuExistsException() {
    return new ConflictException({
      code: 'PRODUCT_VARIANT_SKU_EXISTS',
      message: 'A product variant with this SKU already exists.',
    });
  }

  private variantOptionExistsException() {
    return new ConflictException({
      code: 'PRODUCT_VARIANT_OPTION_EXISTS',
      message: 'A variant with this size and color already exists for this product.',
    });
  }

  private productVariantLimitExceededException() {
    return new BadRequestException({
      code: 'PRODUCT_VARIANT_LIMIT_EXCEEDED',
      message: PRODUCT_VARIANT_LIMIT_MESSAGE,
    });
  }

  private variantUniqueConflictException(error: unknown) {
    const target = this.getUniqueConstraintTarget(error);

    if (target.includes('sku')) {
      return this.skuExistsException();
    }

    return this.variantOptionExistsException();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private getUniqueConstraintTarget(error: unknown): string {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return '';
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.join(',');
    }

    return typeof target === 'string' ? target : '';
  }
}
