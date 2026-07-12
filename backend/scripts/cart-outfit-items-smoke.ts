import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { AuthProvider, UserRole } from '../src/generated/prisma/enums';
import type { AuthenticatedUser } from '../src/auth/types/authenticated-user';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { CartController } from '../src/cart/cart.controller';
import { CartService } from '../src/cart/cart.service';
import { AddOutfitCartItemsDto } from '../src/cart/dto/add-outfit-cart-items.dto';

type FakeArgs = {
  create?: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
  update?: Record<string, unknown>;
  where?: Record<string, any>;
};

type FakeCategory = {
  id: string;
  isActive: boolean;
  name: string;
  slug: string;
};

type FakeProduct = {
  basePrice: number;
  category: FakeCategory;
  id: string;
  imageUrls: string[];
  isActive: boolean;
  name: string;
  slug: string;
};

type FakeVariant = {
  color: string;
  id: string;
  isActive: boolean;
  priceOverride: number | null;
  product: FakeProduct;
  size: string;
  sku: string | null;
  stock: number;
};

type FakeCart = {
  createdAt: Date;
  id: string;
  updatedAt: Date;
  userId: string;
};

type FakeCartItem = {
  cartId: string;
  createdAt: Date;
  id: string;
  quantity: number;
  updatedAt: Date;
  variantId: string;
};

type FakeState = {
  cartItems: Map<string, FakeCartItem>;
  carts: Map<string, FakeCart>;
  nextCartId: number;
  nextCartItemId: number;
  orders: unknown[];
  payments: unknown[];
  products: Map<string, FakeProduct>;
  variants: Map<string, FakeVariant>;
};

type FakeOptions = {
  failOnUpsertVariantId?: string;
};

const user: AuthenticatedUser = {
  id: uuid(9001),
  email: 'outfit-cart-smoke@example.com',
  name: 'Outfit Cart Smoke',
  phone: null,
  role: UserRole.CUSTOMER,
  authProvider: AuthProvider.EMAIL,
  createdAt: new Date('2026-07-12T00:00:00.000Z'),
  updatedAt: new Date('2026-07-12T00:00:00.000Z'),
};

function uuid(value: number) {
  return `00000000-0000-4000-8000-${value
    .toString(16)
    .padStart(12, '0')}`;
}

function makeState(productCount = 8): FakeState {
  const products = new Map<string, FakeProduct>();
  const variants = new Map<string, FakeVariant>();

  for (let index = 1; index <= productCount; index += 1) {
    const category: FakeCategory = {
      id: uuid(1000 + index),
      isActive: true,
      name: `Category ${index}`,
      slug: `category-${index}`,
    };
    const product: FakeProduct = {
      id: uuid(index),
      basePrice: 1000 * index,
      category,
      imageUrls: [`https://example.com/product-${index}.jpg`],
      isActive: true,
      name: `Product ${index}`,
      slug: `product-${index}`,
    };
    const variant: FakeVariant = {
      id: uuid(2000 + index),
      color: `Color ${index}`,
      isActive: true,
      priceOverride: index === 2 ? 7777 : null,
      product,
      size: 'M',
      sku: `SKU-${index}`,
      stock: 10,
    };

    products.set(product.id, product);
    variants.set(variant.id, variant);
  }

  return {
    cartItems: new Map(),
    carts: new Map(),
    nextCartId: 1,
    nextCartItemId: 1,
    orders: [],
    payments: [],
    products,
    variants,
  };
}

function cloneState(state: FakeState): FakeState {
  return {
    cartItems: new Map(
      [...state.cartItems.entries()].map(([id, item]) => [
        id,
        { ...item },
      ]),
    ),
    carts: new Map(
      [...state.carts.entries()].map(([id, cart]) => [
        id,
        { ...cart },
      ]),
    ),
    nextCartId: state.nextCartId,
    nextCartItemId: state.nextCartItemId,
    orders: [...state.orders],
    payments: [...state.payments],
    products: new Map(
      [...state.products.entries()].map(([id, product]) => [
        id,
        {
          ...product,
          category: { ...product.category },
          imageUrls: [...product.imageUrls],
        },
      ]),
    ),
    variants: new Map(
      [...state.variants.entries()].map(([id, variant]) => [
        id,
        {
          ...variant,
          product: {
            ...variant.product,
            category: { ...variant.product.category },
            imageUrls: [...variant.product.imageUrls],
          },
        },
      ]),
    ),
  };
}

class FakePrismaClient {
  constructor(
    protected state: FakeState,
    private readonly options: FakeOptions = {},
  ) {}

  product = {
    findMany: async (args: FakeArgs) => {
      const ids = new Set<string>(args.where?.id?.in ?? []);

      return [...this.state.products.values()].filter((product) =>
        ids.has(product.id),
      );
    },
  };

  productVariant = {
    findMany: async (args: FakeArgs) => {
      const ids = new Set<string>(args.where?.id?.in ?? []);

      return [...this.state.variants.values()].filter((variant) =>
        ids.has(variant.id),
      );
    },
    findUnique: async (args: FakeArgs) => {
      const id = args.where?.id;

      return typeof id === 'string'
        ? this.state.variants.get(id) ?? null
        : null;
    },
  };

  cart = {
    create: async (args: FakeArgs) => {
      const userId = args.data?.userId;

      if (typeof userId !== 'string') {
        throw new Error('Fake cart create requires userId.');
      }

      const existing = [...this.state.carts.values()].find(
        (cart) => cart.userId === userId,
      );

      if (existing) {
        throw new Error('Fake unique cart violation.');
      }

      const now = new Date('2026-07-12T01:00:00.000Z');
      const cart: FakeCart = {
        id: uuid(3000 + this.state.nextCartId),
        userId,
        createdAt: now,
        updatedAt: now,
      };

      this.state.nextCartId += 1;
      this.state.carts.set(cart.id, cart);

      return this.projectCart(cart, args.select);
    },
    findUnique: async (args: FakeArgs) => {
      const cart = this.findCart(args.where);

      return cart ? this.projectCart(cart, args.select) : null;
    },
    findUniqueOrThrow: async (args: FakeArgs) => {
      const cart = this.findCart(args.where);

      if (!cart) {
        throw new Error('Fake cart not found.');
      }

      return this.projectCart(cart, args.select);
    },
    update: async (args: FakeArgs) => {
      const id = args.where?.id;
      const cart = typeof id === 'string' ? this.state.carts.get(id) : null;

      if (!cart) {
        throw new Error('Fake cart update not found.');
      }

      cart.updatedAt =
        args.data?.updatedAt instanceof Date
          ? args.data.updatedAt
          : new Date('2026-07-12T01:00:01.000Z');

      return this.projectCart(cart, args.select);
    },
  };

  cartItem = {
    findUnique: async (args: FakeArgs) => {
      const composite = args.where?.cartId_variantId;
      const item = [...this.state.cartItems.values()].find(
        (entry) =>
          entry.cartId === composite?.cartId &&
          entry.variantId === composite?.variantId,
      );

      return item ? { ...item } : null;
    },
    upsert: async (args: FakeArgs) => {
      const composite = args.where?.cartId_variantId;

      if (composite?.variantId === this.options.failOnUpsertVariantId) {
        throw new Error('Injected fake cart item upsert failure.');
      }

      const existing = [...this.state.cartItems.values()].find(
        (entry) =>
          entry.cartId === composite?.cartId &&
          entry.variantId === composite?.variantId,
      );

      if (existing) {
        existing.quantity = Number(args.update?.quantity);
        existing.updatedAt = new Date('2026-07-12T01:00:02.000Z');

        return { id: existing.id };
      }

      const now = new Date('2026-07-12T01:00:02.000Z');
      const item: FakeCartItem = {
        id: uuid(4000 + this.state.nextCartItemId),
        cartId: String(args.create?.cartId),
        variantId: String(args.create?.variantId),
        quantity: Number(args.create?.quantity),
        createdAt: now,
        updatedAt: now,
      };

      this.state.nextCartItemId += 1;
      this.state.cartItems.set(item.id, item);

      return { id: item.id };
    },
  };

  private findCart(where: Record<string, any> | undefined) {
    if (!where) {
      return null;
    }

    if (typeof where.id === 'string') {
      return this.state.carts.get(where.id) ?? null;
    }

    if (typeof where.userId === 'string') {
      return (
        [...this.state.carts.values()].find(
          (cart) => cart.userId === where.userId,
        ) ?? null
      );
    }

    return null;
  }

  private projectCart(cart: FakeCart, select: Record<string, any> | undefined) {
    if (select && !select.items && Object.keys(select).length === 1) {
      return { id: cart.id };
    }

    const variantIds = new Set<string>(select?.items?.where?.variantId?.in ?? []);
    const items = [...this.state.cartItems.values()]
      .filter(
        (item) =>
          item.cartId === cart.id &&
          (variantIds.size === 0 || variantIds.has(item.variantId)),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((item) => ({
        ...item,
        variant: this.state.variants.get(item.variantId),
      }));

    return {
      ...cart,
      items,
    };
  }
}

class FakePrismaService extends FakePrismaClient {
  constructor(state: FakeState, private readonly fakeOptions: FakeOptions = {}) {
    super(state, fakeOptions);
  }

  async $transaction<T>(callback: (tx: FakePrismaClient) => Promise<T>) {
    const transactionState = cloneState(this.state);
    const tx = new FakePrismaClient(transactionState, this.fakeOptions);

    try {
      const result = await callback(tx);
      this.state = transactionState;
      return result;
    } catch (error) {
      throw error;
    }
  }

  getState() {
    return this.state;
  }
}

function outfitItems(state: FakeState, count: number) {
  return [...state.variants.values()].slice(0, count).map((variant) => ({
    productId: variant.product.id,
    variantId: variant.id,
    quantity: 1,
  }));
}

function createCartWithItems(
  state: FakeState,
  entries: Array<{ quantity: number; variantId: string }>,
) {
  const cart: FakeCart = {
    id: uuid(5001),
    userId: user.id,
    createdAt: new Date('2026-07-12T00:30:00.000Z'),
    updatedAt: new Date('2026-07-12T00:30:00.000Z'),
  };

  state.carts.set(cart.id, cart);

  for (const [index, entry] of entries.entries()) {
    const item: FakeCartItem = {
      id: uuid(6000 + index),
      cartId: cart.id,
      variantId: entry.variantId,
      quantity: entry.quantity,
      createdAt: new Date(`2026-07-12T00:30:0${index}.000Z`),
      updatedAt: new Date(`2026-07-12T00:30:0${index}.000Z`),
    };

    state.cartItems.set(item.id, item);
  }

  return cart;
}

function makeService(
  state = makeState(),
  options: FakeOptions = {},
): { fake: FakePrismaService; service: CartService } {
  const fake = new FakePrismaService(state, options);

  return {
    fake,
    service: new CartService(fake as any),
  };
}

function getErrorPayload(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'getResponse' in error &&
    typeof (error as { getResponse: () => unknown }).getResponse ===
      'function'
  ) {
    return (error as { getResponse: () => unknown }).getResponse() as {
      code?: string;
      details?: {
        invalidItems?: Array<{ code: string }>;
      };
    };
  }

  throw error;
}

async function expectErrorCode(
  label: string,
  action: () => Promise<unknown>,
  expectedCode: string,
) {
  try {
    await action();
  } catch (error) {
    const payload = getErrorPayload(error);

    assert(
      payload.code === expectedCode,
      `${label}: expected ${expectedCode}, received ${payload.code}`,
    );
    return payload;
  }

  throw new Error(`${label}: expected ${expectedCode}, but action succeeded.`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertCounts(
  state: FakeState,
  expected: { cartItems: number; carts: number; orders?: number; payments?: number },
  label: string,
) {
  assert(
    state.carts.size === expected.carts,
    `${label}: expected ${expected.carts} carts, received ${state.carts.size}`,
  );
  assert(
    state.cartItems.size === expected.cartItems,
    `${label}: expected ${expected.cartItems} cart items, received ${state.cartItems.size}`,
  );

  if (expected.orders !== undefined) {
    assert(
      state.orders.length === expected.orders,
      `${label}: expected ${expected.orders} orders, received ${state.orders.length}`,
    );
  }

  if (expected.payments !== undefined) {
    assert(
      state.payments.length === expected.payments,
      `${label}: expected ${expected.payments} payments, received ${state.payments.length}`,
    );
  }
}

function assertCustomerOnlyGuardMetadata() {
  const classGuards = Reflect.getMetadata(
    GUARDS_METADATA,
    CartController,
  ) as unknown[] | undefined;
  const methodGuards = Reflect.getMetadata(
    GUARDS_METADATA,
    CartController.prototype.addOutfitItems,
  ) as unknown[] | undefined;
  const methodRoles = Reflect.getMetadata(
    ROLES_KEY,
    CartController.prototype.addOutfitItems,
  ) as unknown[] | undefined;

  assert(
    classGuards?.includes(JwtAuthGuard),
    'CartController should retain JwtAuthGuard.',
  );
  assert(
    methodGuards?.includes(RolesGuard),
    'POST /cart/outfit-items should use RolesGuard.',
  );
  assert(
    methodRoles?.includes(UserRole.CUSTOMER),
    'POST /cart/outfit-items should require CUSTOMER role.',
  );
}

async function assertDtoUnknownFieldsRejected() {
  const state = makeState();
  const [item] = outfitItems(state, 1);
  const dto = plainToInstance(AddOutfitCartItemsDto, {
    userId: uuid(9901),
    items: [
      {
        ...item,
        price: 1234,
      },
    ],
  });
  const errors = await validate(dto, {
    forbidNonWhitelisted: true,
    whitelist: true,
  });
  const text = JSON.stringify(errors);

  assert(text.includes('userId'), 'DTO should reject root unknown userId.');
  assert(text.includes('price'), 'DTO should reject nested unknown price.');
}

async function assertRequestValidationErrors() {
  {
    const { fake, service } = makeService(makeState());
    await expectErrorCode(
      'missing items',
      () => service.addOutfitItems(user, {} as any),
      'OUTFIT_CART_ITEMS_REQUIRED',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'missing items');
  }

  {
    const { fake, service } = makeService(makeState());
    await expectErrorCode(
      'empty items',
      () => service.addOutfitItems(user, { items: [] }),
      'OUTFIT_CART_ITEMS_REQUIRED',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'empty items');
  }

  {
    const state = makeState(7);
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'too many items',
      () => service.addOutfitItems(user, { items: outfitItems(state, 7) }),
      'OUTFIT_CART_TOO_MANY_ITEMS',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'too many items');
  }

  {
    const state = makeState();
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'quantity invalid',
      () =>
        service.addOutfitItems(user, {
          items: [{ ...outfitItems(state, 1)[0], quantity: 2 }],
        }),
      'OUTFIT_CART_QUANTITY_INVALID',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'quantity invalid');
  }
}

async function assertCatalogValidationErrors() {
  {
    const state = makeState();
    const items = outfitItems(state, 2);
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'duplicate variant',
      () =>
        service.addOutfitItems(user, {
          items: [
            items[0],
            {
              ...items[1],
              variantId: items[0].variantId,
            },
          ],
        }),
      'OUTFIT_CART_DUPLICATE_VARIANT',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'duplicate variant');
  }

  {
    const state = makeState();
    const firstVariant = [...state.variants.values()][0];
    const secondVariant = {
      ...firstVariant,
      id: uuid(2100),
      color: 'Another color',
      stock: 10,
    };
    state.variants.set(secondVariant.id, secondVariant);
    const { fake, service } = makeService(state);

    await expectErrorCode(
      'duplicate product',
      () =>
        service.addOutfitItems(user, {
          items: [
            {
              productId: firstVariant.product.id,
              variantId: firstVariant.id,
              quantity: 1,
            },
            {
              productId: secondVariant.product.id,
              variantId: secondVariant.id,
              quantity: 1,
            },
          ],
        }),
      'OUTFIT_CART_DUPLICATE_PRODUCT',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'duplicate product');
  }

  {
    const state = makeState();
    const items = outfitItems(state, 2);
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'variant product mismatch',
      () =>
        service.addOutfitItems(user, {
          items: [
            {
              productId: items[0].productId,
              variantId: items[1].variantId,
              quantity: 1,
            },
          ],
        }),
      'OUTFIT_CART_VARIANT_PRODUCT_MISMATCH',
    );
    assertCounts(
      fake.getState(),
      { cartItems: 0, carts: 0 },
      'variant product mismatch',
    );
  }

  {
    const state = makeState();
    const item = outfitItems(state, 1)[0];
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'product missing',
      () =>
        service.addOutfitItems(user, {
          items: [{ ...item, productId: uuid(9999) }],
        }),
      'OUTFIT_CART_PRODUCT_UNAVAILABLE',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'product missing');
  }

  {
    const state = makeState();
    const item = outfitItems(state, 1)[0];
    const product = state.products.get(item.productId)!;
    product.isActive = false;
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'product inactive',
      () => service.addOutfitItems(user, { items: [item] }),
      'OUTFIT_CART_PRODUCT_UNAVAILABLE',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'product inactive');
  }

  {
    const state = makeState();
    const item = outfitItems(state, 1)[0];
    const product = state.products.get(item.productId)!;
    product.category.isActive = false;
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'primary category inactive',
      () => service.addOutfitItems(user, { items: [item] }),
      'OUTFIT_CART_PRODUCT_UNAVAILABLE',
    );
    assertCounts(
      fake.getState(),
      { cartItems: 0, carts: 0 },
      'primary category inactive',
    );
  }

  {
    const state = makeState();
    const item = outfitItems(state, 1)[0];
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'variant missing',
      () =>
        service.addOutfitItems(user, {
          items: [{ ...item, variantId: uuid(9998) }],
        }),
      'OUTFIT_CART_VARIANT_UNAVAILABLE',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'variant missing');
  }

  {
    const state = makeState();
    const item = outfitItems(state, 1)[0];
    const variant = state.variants.get(item.variantId)!;
    variant.isActive = false;
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'variant inactive',
      () => service.addOutfitItems(user, { items: [item] }),
      'OUTFIT_CART_VARIANT_UNAVAILABLE',
    );
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'variant inactive');
  }

  {
    const state = makeState();
    const item = outfitItems(state, 1)[0];
    const variant = state.variants.get(item.variantId)!;
    variant.stock = 1;
    createCartWithItems(state, [{ variantId: item.variantId, quantity: 1 }]);
    const { fake, service } = makeService(state);
    await expectErrorCode(
      'insufficient stock with existing cart quantity',
      () => service.addOutfitItems(user, { items: [item] }),
      'OUTFIT_CART_INSUFFICIENT_STOCK',
    );
    assertCounts(
      fake.getState(),
      { cartItems: 1, carts: 1 },
      'insufficient stock with existing cart quantity',
    );
    assert(
      [...fake.getState().cartItems.values()][0].quantity === 1,
      'insufficient stock should leave existing quantity unchanged.',
    );
  }
}

async function assertAtomicSuccessAndMergeBehavior() {
  {
    const state = makeState();
    const { fake, service } = makeService(state);
    const response = await service.addOutfitItems(user, {
      items: outfitItems(state, 3),
    });

    assert(response.cart.items.length === 3, 'valid outfit should add 3 items.');
    assert(response.addedItems.length === 3, 'valid outfit should report 3 added items.');
    assertCounts(
      fake.getState(),
      { cartItems: 3, carts: 1, orders: 0, payments: 0 },
      'valid three-item outfit',
    );
  }

  {
    const state = makeState();
    const items = outfitItems(state, 3);
    createCartWithItems(state, [{ variantId: items[0].variantId, quantity: 2 }]);
    const { fake, service } = makeService(state);
    const response = await service.addOutfitItems(user, { items });
    const matchingRows = [...fake.getState().cartItems.values()].filter(
      (item) => item.variantId === items[0].variantId,
    );

    assert(response.cart.totalQuantity === 5, 'merge should return updated quantity total.');
    assert(matchingRows.length === 1, 'merge should not create duplicate cart rows.');
    assert(matchingRows[0].quantity === 3, 'matching variant quantity should increment by 1.');
    assertCounts(fake.getState(), { cartItems: 3, carts: 1 }, 'existing matching variant');
  }

  {
    const state = makeState();
    const items = outfitItems(state, 3);
    const unrelated = outfitItems(state, 4)[3];
    createCartWithItems(state, [{ variantId: unrelated.variantId, quantity: 4 }]);
    const { fake, service } = makeService(state);
    await service.addOutfitItems(user, { items });

    const unrelatedRow = [...fake.getState().cartItems.values()].find(
      (item) => item.variantId === unrelated.variantId,
    );

    assert(unrelatedRow?.quantity === 4, 'unrelated cart item should be preserved.');
    assertCounts(fake.getState(), { cartItems: 4, carts: 1 }, 'unrelated cart item preserved');
  }

  {
    const state = makeState();
    const [item] = outfitItems(state, 1);
    const variant = state.variants.get(item.variantId)!;
    variant.stock = 2;
    const { fake, service } = makeService(state);

    await service.addOutfitItems(user, { items: [item] });
    await service.addOutfitItems(user, { items: [item] });
    await expectErrorCode(
      'repeated request stock limit',
      () => service.addOutfitItems(user, { items: [item] }),
      'OUTFIT_CART_INSUFFICIENT_STOCK',
    );

    const rows = [...fake.getState().cartItems.values()].filter(
      (entry) => entry.variantId === item.variantId,
    );
    assert(rows.length === 1, 'repeated request should not duplicate rows.');
    assert(rows[0].quantity === 2, 'repeated failed request should leave quantity at stock limit.');
  }
}

async function assertRollbackProof() {
  {
    const state = makeState();
    const items = outfitItems(state, 2);
    const { fake, service } = makeService(state, {
      failOnUpsertVariantId: items[1].variantId,
    });

    try {
      await service.addOutfitItems(user, { items });
      throw new Error('Injected failure should have rejected the transaction.');
    } catch (error) {
      assert(
        error instanceof Error &&
          error.message === 'Injected fake cart item upsert failure.',
        'Injected failure should surface the controlled fake upsert error.',
      );
    }

    assertCounts(
      fake.getState(),
      { cartItems: 0, carts: 0 },
      'rollback after injected failure',
    );
  }

  {
    const state = makeState();
    const items = outfitItems(state, 2);
    createCartWithItems(state, [{ variantId: items[0].variantId, quantity: 2 }]);
    const { fake, service } = makeService(state, {
      failOnUpsertVariantId: items[1].variantId,
    });

    try {
      await service.addOutfitItems(user, { items });
    } catch {
      // Expected injected failure after the first item update inside the transaction.
    }

    const existing = [...fake.getState().cartItems.values()].find(
      (item) => item.variantId === items[0].variantId,
    );
    assert(existing?.quantity === 2, 'rollback should restore existing quantity.');
    assertCounts(
      fake.getState(),
      { cartItems: 1, carts: 1 },
      'existing cart rollback after injected failure',
    );
  }

  {
    const state = makeState();
    const items = outfitItems(state, 2);
    const invalidVariant = state.variants.get(items[1].variantId)!;
    invalidVariant.stock = 0;
    const { fake, service } = makeService(state);

    await expectErrorCode(
      'one valid plus one invalid',
      () => service.addOutfitItems(user, { items }),
      'OUTFIT_CART_INSUFFICIENT_STOCK',
    );
    assertCounts(
      fake.getState(),
      { cartItems: 0, carts: 0 },
      'one valid plus one invalid should not create cart or item',
    );
  }
}

async function assertExistingCartRegressionsAndPricing() {
  {
    const { fake, service } = makeService(makeState());
    const response = await service.getCart(user);

    assert(response.cart.id === null, 'GET /cart no-cart response should have null id.');
    assert(response.cart.items.length === 0, 'GET /cart no-cart response should have empty items.');
    assert(response.cart.totalQuantity === 0, 'GET /cart no-cart total quantity should be 0.');
    assert(response.cart.estimatedSubtotal === 0, 'GET /cart no-cart subtotal should be 0.');
    assertCounts(fake.getState(), { cartItems: 0, carts: 0 }, 'GET /cart non-creating');
  }

  {
    const state = makeState();
    const [item] = outfitItems(state, 1);
    const { fake, service } = makeService(state);

    await service.addItem(user, {
      variantId: item.variantId,
      quantity: 1,
    });

    assertCounts(fake.getState(), { cartItems: 1, carts: 1 }, 'single add cart regression');
  }

  {
    const state = makeState();
    const items = outfitItems(state, 2);
    const { service } = makeService(state);
    const response = await service.addOutfitItems(user, {
      items: [items[1]],
    });

    assert(
      response.addedItems[0].currentUnitPrice === 7777,
      'addedItems should use variant priceOverride when present.',
    );
    assert(
      response.cart.items[0].currentUnitPrice === 7777,
      'cart response should use authoritative current variant price.',
    );
  }
}

async function main() {
  assertCustomerOnlyGuardMetadata();
  await assertDtoUnknownFieldsRejected();
  await assertRequestValidationErrors();
  await assertCatalogValidationErrors();
  await assertAtomicSuccessAndMergeBehavior();
  await assertRollbackProof();
  await assertExistingCartRegressionsAndPricing();

  console.log('cart-outfit-items-smoke: PASS');
}

void main().catch((error) => {
  console.error('cart-outfit-items-smoke: FAIL');
  console.error(error);
  process.exitCode = 1;
});
