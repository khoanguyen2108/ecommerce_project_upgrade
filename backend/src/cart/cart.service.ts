import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AddCartItemDto } from './dto/add-cart-item.dto';
import type {
  AddOutfitCartItemDto,
  AddOutfitCartItemsDto,
} from './dto/add-outfit-cart-items.dto';
import type { CartResponseDto } from './dto/cart-response.dto';
import type { UpdateCartItemDto } from './dto/update-cart-item.dto';

const MAX_CART_ITEM_QUANTITY = 99;
const MAX_OUTFIT_CART_ITEMS = 6;
const OUTFIT_CART_ITEM_QUANTITY = 1;

const cartItemVariantSelect = {
  id: true,
  sku: true,
  size: true,
  color: true,
  stock: true,
  priceOverride: true,
  isActive: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      imageUrls: true,
      isActive: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
    },
  },
} as const satisfies Prisma.ProductVariantSelect;

const cartSelect = {
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      variantId: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
      variant: {
        select: cartItemVariantSelect,
      },
    },
  },
} as const satisfies Prisma.CartSelect;

const cartItemOwnerSelect = {
  id: true,
  cartId: true,
} as const satisfies Prisma.CartItemSelect;

const cartItemForUpdateSelect = {
  ...cartItemOwnerSelect,
  variant: {
    select: cartItemVariantSelect,
  },
} as const satisfies Prisma.CartItemSelect;

const outfitCartProductSelect = {
  id: true,
  isActive: true,
  category: {
    select: {
      isActive: true,
    },
  },
} as const satisfies Prisma.ProductSelect;

type CartRecord = Prisma.CartGetPayload<{ select: typeof cartSelect }>;
type VariantForCart = Prisma.ProductVariantGetPayload<{
  select: typeof cartItemVariantSelect;
}>;
type ProductForOutfitCart = Prisma.ProductGetPayload<{
  select: typeof outfitCartProductSelect;
}>;

type OutfitCartErrorCode =
  | 'OUTFIT_CART_DUPLICATE_PRODUCT'
  | 'OUTFIT_CART_DUPLICATE_VARIANT'
  | 'OUTFIT_CART_INSUFFICIENT_STOCK'
  | 'OUTFIT_CART_ITEMS_REQUIRED'
  | 'OUTFIT_CART_PRODUCT_UNAVAILABLE'
  | 'OUTFIT_CART_QUANTITY_INVALID'
  | 'OUTFIT_CART_TOO_MANY_ITEMS'
  | 'OUTFIT_CART_VARIANT_PRODUCT_MISMATCH'
  | 'OUTFIT_CART_VARIANT_UNAVAILABLE';

interface OutfitCartInvalidItem {
  code: OutfitCartErrorCode;
  productId: string;
  variantId: string;
}

interface ExistingOutfitCartItem {
  quantity: number;
  variantId: string;
}

@Injectable()
export class CartService {
  constructor(private readonly prismaService: PrismaService) {}

  async getCart(user: AuthenticatedUser) {
    const cart = await this.prismaService.cart.findUnique({
      where: {
        userId: user.id,
      },
      select: cartSelect,
    });

    return {
      cart: cart ? this.toCartResponse(cart) : this.toEmptyCartResponse(user.id),
    };
  }

  async addItem(user: AuthenticatedUser, dto: AddCartItemDto) {
    this.assertQuantityInRange(dto.quantity);

    const cart = await this.prismaService.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: {
          id: dto.variantId,
        },
        select: cartItemVariantSelect,
      });

      this.assertVariantCanBeCarted(variant, dto.quantity);

      const cartSummary = await this.getOrCreateCartSummary(tx, user.id);
      const existingItem = await tx.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: cartSummary.id,
            variantId: dto.variantId,
          },
        },
        select: {
          quantity: true,
        },
      });
      const nextQuantity = (existingItem?.quantity ?? 0) + dto.quantity;

      this.assertQuantityInRange(nextQuantity);
      this.assertStockAvailable(variant, nextQuantity);

      await tx.cartItem.upsert({
        where: {
          cartId_variantId: {
            cartId: cartSummary.id,
            variantId: dto.variantId,
          },
        },
        create: {
          cartId: cartSummary.id,
          variantId: dto.variantId,
          quantity: nextQuantity,
        },
        update: {
          quantity: nextQuantity,
        },
        select: {
          id: true,
        },
      });
      await this.touchCart(tx, cartSummary.id);

      return this.getCartRecordById(tx, cartSummary.id);
    });

    return { cart: this.toCartResponse(cart) };
  }

  async addOutfitItems(user: AuthenticatedUser, dto: AddOutfitCartItemsDto) {
    this.assertOutfitItemsRequest(dto.items);
    this.assertNoDuplicateOutfitValues(
      dto.items,
      (item) => item.variantId,
      'OUTFIT_CART_DUPLICATE_VARIANT',
    );
    this.assertNoDuplicateOutfitValues(
      dto.items,
      (item) => item.productId,
      'OUTFIT_CART_DUPLICATE_PRODUCT',
    );

    const result = await this.prismaService.$transaction(async (tx) => {
      const productIds = dto.items.map((item) => item.productId);
      const variantIds = dto.items.map((item) => item.variantId);
      const [products, variants, currentCart] = await Promise.all([
        tx.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          select: outfitCartProductSelect,
        }),
        tx.productVariant.findMany({
          where: {
            id: {
              in: variantIds,
            },
          },
          select: cartItemVariantSelect,
        }),
        tx.cart.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            items: {
              where: {
                variantId: {
                  in: variantIds,
                },
              },
              select: {
                quantity: true,
                variantId: true,
              },
            },
          },
        }),
      ]);

      const productById = new Map(
        products.map((product) => [product.id, product]),
      );
      const variantById = new Map(
        variants.map((variant) => [variant.id, variant]),
      );
      const existingQuantities = this.toExistingQuantityMap(
        currentCart?.items ?? [],
      );
      const validationIssues = this.getOutfitCartValidationIssues(
        dto.items,
        productById,
        variantById,
        existingQuantities,
      );

      if (validationIssues.length > 0) {
        throw this.outfitCartInvalidItemsException(validationIssues);
      }

      const cartSummary =
        currentCart ?? (await this.getOrCreateCartSummary(tx, user.id));
      const addedItems = dto.items.map((item) => {
        const variant = variantById.get(item.variantId)!;

        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: OUTFIT_CART_ITEM_QUANTITY,
          currentUnitPrice:
            variant.priceOverride ?? variant.product.basePrice,
        };
      });

      for (const item of dto.items) {
        const nextQuantity =
          (existingQuantities.get(item.variantId) ?? 0) +
          OUTFIT_CART_ITEM_QUANTITY;

        await tx.cartItem.upsert({
          where: {
            cartId_variantId: {
              cartId: cartSummary.id,
              variantId: item.variantId,
            },
          },
          create: {
            cartId: cartSummary.id,
            variantId: item.variantId,
            quantity: nextQuantity,
          },
          update: {
            quantity: nextQuantity,
          },
          select: {
            id: true,
          },
        });
      }

      await this.touchCart(tx, cartSummary.id);

      return {
        addedItems,
        cart: await this.getCartRecordById(tx, cartSummary.id),
      };
    });

    return {
      cart: this.toCartResponse(result.cart),
      addedItems: result.addedItems,
    };
  }

  async updateItem(
    user: AuthenticatedUser,
    itemId: string,
    dto: UpdateCartItemDto,
  ) {
    this.assertQuantityInRange(dto.quantity);

    const cart = await this.prismaService.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: {
          id: itemId,
          cart: {
            userId: user.id,
          },
        },
        select: cartItemForUpdateSelect,
      });

      if (!item) {
        throw this.cartItemNotFoundException();
      }

      this.assertVariantCanBeCarted(item.variant, dto.quantity);

      await tx.cartItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity: dto.quantity,
        },
        select: {
          id: true,
        },
      });
      await this.touchCart(tx, item.cartId);

      return this.getCartRecordById(tx, item.cartId);
    });

    return { cart: this.toCartResponse(cart) };
  }

  async removeItem(user: AuthenticatedUser, itemId: string) {
    const cart = await this.prismaService.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: {
          id: itemId,
          cart: {
            userId: user.id,
          },
        },
        select: cartItemOwnerSelect,
      });

      if (!item) {
        throw this.cartItemNotFoundException();
      }

      await tx.cartItem.delete({
        where: {
          id: item.id,
        },
        select: {
          id: true,
        },
      });
      await this.touchCart(tx, item.cartId);

      return this.getCartRecordById(tx, item.cartId);
    });

    return { cart: this.toCartResponse(cart) };
  }

  async clearCart(user: AuthenticatedUser) {
    const cart = await this.prismaService.$transaction(async (tx) => {
      const cartSummary = await tx.cart.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (!cartSummary) {
        return null;
      }

      await tx.cartItem.deleteMany({
        where: {
          cartId: cartSummary.id,
        },
      });
      await this.touchCart(tx, cartSummary.id);

      return this.getCartRecordById(tx, cartSummary.id);
    });

    return {
      cart: cart ? this.toCartResponse(cart) : this.toEmptyCartResponse(user.id),
    };
  }

  private assertOutfitItemsRequest(
    items: AddOutfitCartItemsDto['items'] | undefined,
  ): asserts items is AddOutfitCartItemDto[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw this.outfitCartBadRequestException(
        'OUTFIT_CART_ITEMS_REQUIRED',
      );
    }

    if (items.length > MAX_OUTFIT_CART_ITEMS) {
      throw this.outfitCartBadRequestException(
        'OUTFIT_CART_TOO_MANY_ITEMS',
      );
    }

    const invalidItems = items
      .filter(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity !== OUTFIT_CART_ITEM_QUANTITY,
      )
      .map((item) => this.toOutfitCartInvalidItem(
        item,
        'OUTFIT_CART_QUANTITY_INVALID',
      ));

    if (invalidItems.length > 0) {
      throw this.outfitCartInvalidItemsException(invalidItems);
    }
  }

  private assertNoDuplicateOutfitValues(
    items: AddOutfitCartItemDto[],
    getValue: (item: AddOutfitCartItemDto) => string,
    code: Extract<
      OutfitCartErrorCode,
      'OUTFIT_CART_DUPLICATE_PRODUCT' | 'OUTFIT_CART_DUPLICATE_VARIANT'
    >,
  ) {
    const counts = new Map<string, number>();

    for (const item of items) {
      const value = getValue(item);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const duplicateValues = new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([value]) => value),
    );

    if (duplicateValues.size === 0) {
      return;
    }

    throw this.outfitCartInvalidItemsException(
      items
        .filter((item) => duplicateValues.has(getValue(item)))
        .map((item) => this.toOutfitCartInvalidItem(item, code)),
    );
  }

  private getOutfitCartValidationIssues(
    items: AddOutfitCartItemDto[],
    productById: Map<string, ProductForOutfitCart>,
    variantById: Map<string, VariantForCart>,
    existingQuantities: Map<string, number>,
  ): OutfitCartInvalidItem[] {
    const issues: OutfitCartInvalidItem[] = [];

    for (const item of items) {
      const product = productById.get(item.productId);

      if (!product || !product.isActive || !product.category.isActive) {
        issues.push(
          this.toOutfitCartInvalidItem(
            item,
            'OUTFIT_CART_PRODUCT_UNAVAILABLE',
          ),
        );
        continue;
      }

      const variant = variantById.get(item.variantId);

      if (!variant || !variant.isActive) {
        issues.push(
          this.toOutfitCartInvalidItem(
            item,
            'OUTFIT_CART_VARIANT_UNAVAILABLE',
          ),
        );
        continue;
      }

      if (variant.product.id !== item.productId) {
        issues.push(
          this.toOutfitCartInvalidItem(
            item,
            'OUTFIT_CART_VARIANT_PRODUCT_MISMATCH',
          ),
        );
        continue;
      }

      const nextQuantity =
        (existingQuantities.get(item.variantId) ?? 0) +
        OUTFIT_CART_ITEM_QUANTITY;

      if (nextQuantity > MAX_CART_ITEM_QUANTITY) {
        issues.push(
          this.toOutfitCartInvalidItem(
            item,
            'OUTFIT_CART_QUANTITY_INVALID',
          ),
        );
        continue;
      }

      if (variant.stock <= 0 || nextQuantity > variant.stock) {
        issues.push(
          this.toOutfitCartInvalidItem(
            item,
            'OUTFIT_CART_INSUFFICIENT_STOCK',
          ),
        );
      }
    }

    return issues;
  }

  private toExistingQuantityMap(items: ExistingOutfitCartItem[]) {
    return new Map(items.map((item) => [item.variantId, item.quantity]));
  }

  private toOutfitCartInvalidItem(
    item: AddOutfitCartItemDto,
    code: OutfitCartErrorCode,
  ): OutfitCartInvalidItem {
    return {
      productId: item.productId,
      variantId: item.variantId,
      code,
    };
  }

  private outfitCartInvalidItemsException(issues: OutfitCartInvalidItem[]) {
    const primaryIssue = issues[0];

    return new BadRequestException({
      code: primaryIssue.code,
      message: this.getOutfitCartErrorMessage(primaryIssue.code),
      details: {
        invalidItems: issues,
      },
    });
  }

  private outfitCartBadRequestException(code: OutfitCartErrorCode) {
    return new BadRequestException({
      code,
      message: this.getOutfitCartErrorMessage(code),
    });
  }

  private getOutfitCartErrorMessage(code: OutfitCartErrorCode): string {
    switch (code) {
      case 'OUTFIT_CART_DUPLICATE_PRODUCT':
        return 'Each outfit product can be submitted only once.';
      case 'OUTFIT_CART_DUPLICATE_VARIANT':
        return 'Each outfit variant can be submitted only once.';
      case 'OUTFIT_CART_INSUFFICIENT_STOCK':
        return 'Requested quantity is not available for one or more outfit items.';
      case 'OUTFIT_CART_ITEMS_REQUIRED':
        return 'At least one outfit item is required.';
      case 'OUTFIT_CART_PRODUCT_UNAVAILABLE':
        return 'One or more products are currently unavailable.';
      case 'OUTFIT_CART_QUANTITY_INVALID':
        return 'Outfit item quantity must be exactly 1.';
      case 'OUTFIT_CART_TOO_MANY_ITEMS':
        return 'Outfit cart requests can include at most 6 items.';
      case 'OUTFIT_CART_VARIANT_PRODUCT_MISMATCH':
        return 'One or more variants do not belong to the submitted product.';
      case 'OUTFIT_CART_VARIANT_UNAVAILABLE':
        return 'One or more product variants are currently unavailable.';
    }
  }

  private async getOrCreateCartSummary(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const existingCart = await tx.cart.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (existingCart) {
      return existingCart;
    }

    try {
      return await tx.cart.create({
        data: {
          userId,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      return tx.cart.findUniqueOrThrow({
        where: {
          userId,
        },
        select: {
          id: true,
        },
      });
    }
  }

  private getCartRecordById(tx: Prisma.TransactionClient, id: string) {
    return tx.cart.findUniqueOrThrow({
      where: {
        id,
      },
      select: cartSelect,
    });
  }

  private async touchCart(tx: Prisma.TransactionClient, id: string) {
    await tx.cart.update({
      where: {
        id,
      },
      data: {
        updatedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  }

  private toCartResponse(cart: CartRecord): CartResponseDto {
    const items = cart.items.map((item) => {
      const unitPrice =
        item.variant.priceOverride ?? item.variant.product.basePrice;
      const lineTotal = unitPrice * item.quantity;
      const imageUrls = item.variant.product.imageUrls;

      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        currentUnitPrice: unitPrice,
        currentLineTotal: lineTotal,
        availableStock: item.variant.stock,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          slug: item.variant.product.slug,
          imageUrls,
          firstImageUrl: imageUrls[0] ?? null,
          category: {
            id: item.variant.product.category.id,
            name: item.variant.product.category.name,
            slug: item.variant.product.category.slug,
          },
        },
        variant: {
          sku: item.variant.sku,
          size: item.variant.size,
          color: item.variant.color,
          priceOverride: item.variant.priceOverride,
          stock: item.variant.stock,
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
      estimatedSubtotal: items.reduce(
        (total, item) => total + item.currentLineTotal,
        0,
      ),
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private toEmptyCartResponse(userId: string): CartResponseDto {
    return {
      id: null,
      userId,
      items: [],
      totalQuantity: 0,
      estimatedSubtotal: 0,
      createdAt: null,
      updatedAt: null,
    };
  }

  private assertVariantCanBeCarted(
    variant: VariantForCart | null,
    quantity: number,
  ): asserts variant is VariantForCart {
    if (!variant) {
      throw new NotFoundException({
        code: 'CART_VARIANT_NOT_FOUND',
        message: 'Product variant was not found.',
      });
    }

    if (!variant.isActive) {
      throw new BadRequestException({
        code: 'CART_VARIANT_INACTIVE',
        message: 'Product variant is inactive.',
      });
    }

    if (!variant.product.isActive) {
      throw new BadRequestException({
        code: 'CART_PRODUCT_INACTIVE',
        message: 'Product is inactive.',
      });
    }

    if (!variant.product.category.isActive) {
      throw new BadRequestException({
        code: 'CART_CATEGORY_INACTIVE',
        message: 'Product category is inactive.',
      });
    }

    this.assertStockAvailable(variant, quantity);
  }

  private assertStockAvailable(variant: VariantForCart, quantity: number) {
    if (variant.stock <= 0 || quantity > variant.stock) {
      throw new BadRequestException({
        code: 'CART_ITEM_STOCK_UNAVAILABLE',
        message: 'Requested quantity is not available for this item.',
      });
    }
  }

  private assertQuantityInRange(quantity: number) {
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_CART_ITEM_QUANTITY
    ) {
      throw new BadRequestException({
        code: 'CART_ITEM_QUANTITY_INVALID',
        message: 'Cart item quantity must be an integer from 1 to 99.',
      });
    }
  }

  private cartItemNotFoundException() {
    return new NotFoundException({
      code: 'CART_ITEM_NOT_FOUND',
      message: 'Cart item was not found.',
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
