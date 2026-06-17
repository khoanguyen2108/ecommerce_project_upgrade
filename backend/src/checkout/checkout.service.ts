import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { OrderEmailService } from '../email/order-email.service';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus } from '../generated/prisma/enums';
import { OrderExpiryService } from '../order-expiry/order-expiry.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CheckoutSummaryItemResponseDto,
  CheckoutSummaryResponseDto,
} from './dto/checkout-summary-response.dto';

const MAX_CHECKOUT_ITEM_QUANTITY = 99;
const MAX_ORDER_TOTAL = 2_000_000_000;
const DEFAULT_CURRENCY = 'VND';

const checkoutCartItemVariantSelect = {
  id: true,
  productId: true,
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

const checkoutCartSelect = {
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
        select: checkoutCartItemVariantSelect,
      },
    },
  },
} as const satisfies Prisma.CartSelect;

const checkoutOrderItemSelect = {
  id: true,
  orderId: true,
  productId: true,
  variantId: true,
  productName: true,
  sku: true,
  size: true,
  color: true,
  unitPrice: true,
  quantity: true,
  lineTotal: true,
  createdAt: true,
} as const satisfies Prisma.OrderItemSelect;

const checkoutPaymentSelect = {
  id: true,
  orderId: true,
  provider: true,
  status: true,
  amount: true,
  currency: true,
  providerOrderCode: true,
  checkoutUrl: true,
  providerPaymentLinkId: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
} as const satisfies Prisma.PaymentSelect;

const checkoutOrderSelect = {
  id: true,
  userId: true,
  status: true,
  subtotalAmount: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
  expiresAt: true,
  items: {
    orderBy: {
      createdAt: 'asc',
    },
    select: checkoutOrderItemSelect,
  },
  payments: {
    orderBy: {
      createdAt: 'desc',
    },
    select: checkoutPaymentSelect,
  },
} as const satisfies Prisma.OrderSelect;

type CheckoutCartRecord = Prisma.CartGetPayload<{
  select: typeof checkoutCartSelect;
}>;

type CheckoutCartItemRecord = CheckoutCartRecord['items'][number];

type CheckoutValidationCode =
  | 'CHECKOUT_CATEGORY_INACTIVE'
  | 'CHECKOUT_ITEM_QUANTITY_INVALID'
  | 'CHECKOUT_ITEM_STOCK_UNAVAILABLE'
  | 'CHECKOUT_PRODUCT_INACTIVE'
  | 'CHECKOUT_VARIANT_INACTIVE'
  | 'CHECKOUT_VARIANT_NOT_FOUND';

interface CheckoutValidationIssue {
  availableStock?: number;
  cartItemId: string;
  code: CheckoutValidationCode;
  message: string;
  productId?: string;
  productName?: string;
  quantity: number;
  sku?: string | null;
  variantId: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly orderEmailService: OrderEmailService,
    private readonly orderExpiryService: OrderExpiryService,
    private readonly prismaService: PrismaService,
  ) {}

  async getSummary(user: AuthenticatedUser) {
    const cart = await this.prismaService.cart.findUnique({
      where: {
        userId: user.id,
      },
      select: checkoutCartSelect,
    });

    this.assertCartNotEmpty(cart);

    return {
      summary: this.toValidatedSummary(cart),
    };
  }

  async createOrderFromCart(user: AuthenticatedUser) {
    const order = await this.prismaService.$transaction(async (tx) => {
      const cartSummary = await tx.cart.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (!cartSummary) {
        throw this.cartEmptyException();
      }

      await tx.cart.update({
        where: {
          id: cartSummary.id,
        },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      const cart = await tx.cart.findUniqueOrThrow({
        where: {
          id: cartSummary.id,
        },
        select: checkoutCartSelect,
      });

      this.assertCartNotEmpty(cart);
      const summary = this.toValidatedSummary(cart);

      const createdOrder = await tx.order.create({
        data: {
          userId: user.id,
          status: OrderStatus.PENDING_PAYMENT,
          subtotalAmount: summary.subtotalAmount,
          totalAmount: summary.totalAmount,
          currency: summary.currency,
          expiresAt: this.orderExpiryService.getPendingOrderExpiresAt(),
          items: {
            create: summary.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              sku: item.sku,
              size: item.size,
              color: item.color,
              unitPrice: item.currentUnitPrice,
              quantity: item.quantity,
              lineTotal: item.currentLineTotal,
            })),
          },
        },
        select: checkoutOrderSelect,
      });

      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });
      await tx.cart.update({
        where: {
          id: cart.id,
        },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      return createdOrder;
    });

    void this.orderEmailService.sendOrderCreatedEmail(order.id);

    return {
      order,
    };
  }

  private toValidatedSummary(cart: CheckoutCartRecord): CheckoutSummaryResponseDto {
    const validationIssues = cart.items
      .map((item) => this.getValidationIssue(item))
      .filter((issue): issue is CheckoutValidationIssue => Boolean(issue));

    if (validationIssues.length > 0) {
      throw this.invalidItemsException(validationIssues);
    }

    const items = cart.items.map((item) => this.toSummaryItem(item));
    const subtotalAmount = items.reduce(
      (total, item) => total + item.currentLineTotal,
      0,
    );
    const totalQuantity = items.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    if (
      !Number.isSafeInteger(subtotalAmount) ||
      subtotalAmount <= 0 ||
      subtotalAmount > MAX_ORDER_TOTAL
    ) {
      throw new BadRequestException({
        code: 'CHECKOUT_TOTAL_INVALID',
        message: 'Checkout total is invalid.',
      });
    }

    return {
      items,
      totalQuantity,
      subtotalAmount,
      totalAmount: subtotalAmount,
      currency: DEFAULT_CURRENCY,
      warnings: [],
    };
  }

  private toSummaryItem(
    item: CheckoutCartItemRecord,
  ): CheckoutSummaryItemResponseDto {
    const variant = item.variant;
    const product = variant.product;
    const imageUrls = product.imageUrls;
    const currentUnitPrice = variant.priceOverride ?? product.basePrice;
    const currentLineTotal = currentUnitPrice * item.quantity;

    if (
      !Number.isSafeInteger(currentUnitPrice) ||
      currentUnitPrice <= 0 ||
      !Number.isSafeInteger(currentLineTotal) ||
      currentLineTotal <= 0
    ) {
      throw new BadRequestException({
        code: 'CHECKOUT_TOTAL_INVALID',
        message: 'Checkout total is invalid.',
      });
    }

    return {
      cartItemId: item.id,
      variantId: item.variantId,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
      categoryName: product.category.name,
      categorySlug: product.category.slug,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      quantity: item.quantity,
      availableStock: variant.stock,
      currentUnitPrice,
      currentLineTotal,
    };
  }

  private getValidationIssue(
    item: CheckoutCartItemRecord,
  ): CheckoutValidationIssue | null {
    const variant = item.variant;
    const baseIssue = {
      cartItemId: item.id,
      quantity: item.quantity,
      variantId: item.variantId,
    };

    if (!variant) {
      return {
        ...baseIssue,
        code: 'CHECKOUT_VARIANT_NOT_FOUND',
        message: 'Product variant was not found.',
      };
    }

    const issueContext = {
      ...baseIssue,
      availableStock: variant.stock,
      productId: variant.product.id,
      productName: variant.product.name,
      sku: variant.sku,
    };

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > MAX_CHECKOUT_ITEM_QUANTITY
    ) {
      return {
        ...issueContext,
        code: 'CHECKOUT_ITEM_QUANTITY_INVALID',
        message: 'Checkout item quantity must be an integer from 1 to 99.',
      };
    }

    if (!variant.product.category.isActive) {
      return {
        ...issueContext,
        code: 'CHECKOUT_CATEGORY_INACTIVE',
        message: 'Product category is inactive.',
      };
    }

    if (!variant.product.isActive) {
      return {
        ...issueContext,
        code: 'CHECKOUT_PRODUCT_INACTIVE',
        message: 'Product is inactive.',
      };
    }

    if (!variant.isActive) {
      return {
        ...issueContext,
        code: 'CHECKOUT_VARIANT_INACTIVE',
        message: 'Product variant is inactive.',
      };
    }

    if (variant.stock < item.quantity) {
      return {
        ...issueContext,
        code: 'CHECKOUT_ITEM_STOCK_UNAVAILABLE',
        message: 'Requested quantity is not available for this item.',
      };
    }

    return null;
  }

  private assertCartNotEmpty(
    cart: CheckoutCartRecord | null,
  ): asserts cart is CheckoutCartRecord {
    if (!cart || cart.items.length === 0) {
      throw this.cartEmptyException();
    }
  }

  private cartEmptyException() {
    return new BadRequestException({
      code: 'CHECKOUT_CART_EMPTY',
      message: 'Cart is empty.',
    });
  }

  private invalidItemsException(issues: CheckoutValidationIssue[]) {
    const primaryIssue = issues[0];

    return new BadRequestException({
      code: primaryIssue.code,
      message: primaryIssue.message,
      details: {
        invalidItems: issues,
      },
    });
  }
}
