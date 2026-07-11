import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HttpException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../src/auth/types/authenticated-user';
import { UserRole } from '../src/generated/prisma/enums';
import type { PrismaService } from '../src/prisma/prisma.service';
import {
  CreateSavedOutfitDto,
  SavedOutfitItemRole,
  type SavedOutfitItemSnapshotDto,
} from '../src/saved-outfits/dto/create-saved-outfit.dto';
import { SavedOutfitsController } from '../src/saved-outfits/saved-outfits.controller';
import { SavedOutfitsService } from '../src/saved-outfits/saved-outfits.service';

const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_B_ID = '22222222-2222-4222-8222-222222222222';
const TOP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const BOTTOM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const SHOES_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
const EXTRA_IDS = [
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  'ffffffff-ffff-4fff-8fff-fffffffffff6',
  '99999999-9999-4999-8999-999999999997',
] as const;
const TOP_VARIANT_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1';
const BOTTOM_VARIANT_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbb2';
const SHOES_VARIANT_ID = 'cccccccc-3333-4333-8333-ccccccccccc3';
const UNAVAILABLE_ID = '99999999-9999-4999-8999-999999999998';
const UNAVAILABLE_VARIANT_ID = '99999999-9999-4999-8999-999999999999';

type CatalogProduct = {
  id: string;
  isActive: boolean;
  category: { isActive: boolean };
  variants: Array<{ id: string; isActive: boolean; stock: number }>;
};

type StoredOutfit = {
  id: string;
  userId: string;
  sourcePrompt: string;
  locale: string;
  summary: string;
  totalPriceSnapshot: number;
  items: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const catalogProducts: CatalogProduct[] = [
  [TOP_ID, TOP_VARIANT_ID],
  [BOTTOM_ID, BOTTOM_VARIANT_ID],
  [SHOES_ID, SHOES_VARIANT_ID],
  ...EXTRA_IDS.map((id, index) => [
    id,
    `88888888-8888-4888-8888-88888888888${index}`,
  ]),
].map(([id, variantId]) => ({
  id,
  isActive: true,
  category: { isActive: true },
  variants: [{ id: variantId, isActive: true, stock: 5 }],
}));

class FixturePrisma {
  private readonly catalog = new Map(
    catalogProducts.map((product) => [product.id, product]),
  );
  private records: StoredOutfit[] = [];
  private sequence = 0;
  readonly commerceMutations = { cart: 0, order: 0, payment: 0 };

  readonly product = {
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.flatMap((id) => {
        const product = this.catalog.get(id);

        if (!product) {
          return [];
        }

        return [
          {
            id: product.id,
            isActive: product.isActive,
            category: product.category,
            variants: product.variants
              .filter((variant) => variant.isActive && variant.stock > 0)
              .map(({ id: variantId }) => ({ id: variantId })),
          },
        ];
      }),
  };

  readonly savedOutfit = {
    create: async ({ data }: { data: Omit<StoredOutfit, 'id' | 'createdAt' | 'updatedAt'> }) => {
      this.sequence += 1;
      const createdAt = new Date(Date.UTC(2026, 6, 11, 12, 0, this.sequence));
      const record: StoredOutfit = {
        ...data,
        id: `77777777-7777-4777-8777-${String(this.sequence).padStart(12, '0')}`,
        createdAt,
        updatedAt: createdAt,
      };
      this.records.push(record);

      return this.toPublicRecord(record);
    },
    findMany: async ({ where, take }: { where: { userId: string }; take: number }) =>
      this.records
        .filter((record) => record.userId === where.userId)
        .sort(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime() ||
            right.id.localeCompare(left.id),
        )
        .slice(0, take)
        .map((record) => this.toPublicRecord(record)),
    findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
      const record = this.records.find(
        (entry) => entry.id === where.id && entry.userId === where.userId,
      );

      return record ? this.toPublicRecord(record) : null;
    },
    deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
      const previousLength = this.records.length;
      this.records = this.records.filter(
        (entry) => !(entry.id === where.id && entry.userId === where.userId),
      );

      return { count: previousLength - this.records.length };
    },
  };

  private toPublicRecord({ userId: _userId, ...record }: StoredOutfit) {
    return record;
  }
}

const customer = (id: string) =>
  ({ id, role: UserRole.CUSTOMER }) as AuthenticatedUser;

const validItems = (): SavedOutfitItemSnapshotDto[] => [
  {
    role: SavedOutfitItemRole.TOP,
    productId: TOP_ID,
    variantId: TOP_VARIANT_ID,
    productNameSnapshot: 'Classic Cotton Tee',
    productSlugSnapshot: 'classic-cotton-tee',
    imageUrlSnapshot: 'https://cdn.example.com/top.webp',
    unitPriceSnapshot: 250_000,
    quantity: 1,
  },
  {
    role: SavedOutfitItemRole.BOTTOM,
    productId: BOTTOM_ID,
    variantId: BOTTOM_VARIANT_ID,
    productNameSnapshot: 'Relaxed Trousers',
    productSlugSnapshot: 'relaxed-trousers',
    unitPriceSnapshot: 400_000,
    quantity: 1,
  },
  {
    role: SavedOutfitItemRole.SHOES,
    productId: SHOES_ID,
    productNameSnapshot: 'Street Boots',
    productSlugSnapshot: 'street-boots',
    unitPriceSnapshot: 600_000,
    quantity: 1,
  },
];

const validPayload = (summary = 'A three-piece streetwear outfit.') => ({
  sourcePrompt: 'Streetwear outfit with a black tee and boots',
  locale: 'en',
  summary,
  items: validItems(),
});

const toValidatedDto = async (payload: object) => {
  const dto = plainToInstance(CreateSavedOutfitDto, payload);
  const errors = await validate(dto, {
    forbidNonWhitelisted: true,
    whitelist: true,
  });

  assert.equal(errors.length, 0, JSON.stringify(errors));
  return dto;
};

const assertInvalidDto = async (payload: object, label: string) => {
  const dto = plainToInstance(CreateSavedOutfitDto, payload);
  const errors = await validate(dto, {
    forbidNonWhitelisted: true,
    whitelist: true,
  });

  assert.ok(errors.length > 0, `${label} should fail DTO validation`);
};

const hasCode = (expectedCode: string) => (error: unknown) => {
  if (!(error instanceof HttpException)) {
    return false;
  }

  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    response.code === expectedCode
  );
};

async function main() {
  const fixture = new FixturePrisma();
  const service = new SavedOutfitsService(
    fixture as unknown as PrismaService,
  );
  const userA = customer(USER_A_ID);
  const userB = customer(USER_B_ID);

  const roles = Reflect.getMetadata(ROLES_KEY, SavedOutfitsController);
  const guards = Reflect.getMetadata(GUARDS_METADATA, SavedOutfitsController);
  assert.deepEqual(roles, [UserRole.CUSTOMER]);
  assert.ok(guards.includes(JwtAuthGuard));
  assert.ok(guards.includes(RolesGuard));

  const userBDto = await toValidatedDto(validPayload('Other customer outfit'));
  const userBResult = await service.create(userB, userBDto);

  const dto = await toValidatedDto(validPayload());
  const created = await service.create(userA, dto);
  assert.equal(created.savedOutfit.totalPriceSnapshot, 1_250_000);
  assert.equal('userId' in created.savedOutfit, false);
  assert.equal('user' in created.savedOutfit, false);

  const newerDto = await toValidatedDto(validPayload('Newest outfit'));
  const newer = await service.create(userA, newerDto);
  const listed = await service.list(userA);
  assert.deepEqual(
    listed.savedOutfits.map((outfit) => outfit.id),
    [newer.savedOutfit.id, created.savedOutfit.id],
  );
  assert.equal(
    listed.savedOutfits.some((outfit) => outfit.id === userBResult.savedOutfit.id),
    false,
  );

  const detail = await service.get(userA, created.savedOutfit.id);
  assert.equal(detail.savedOutfit.id, created.savedOutfit.id);
  await assert.rejects(
    () => service.get(userB, created.savedOutfit.id),
    hasCode('SAVED_OUTFIT_NOT_FOUND'),
  );
  await assert.rejects(
    () => service.remove(userB, created.savedOutfit.id),
    hasCode('SAVED_OUTFIT_NOT_FOUND'),
  );

  const duplicateRoleDto = await toValidatedDto({
    ...validPayload(),
    items: [validItems()[0], { ...validItems()[1], role: SavedOutfitItemRole.TOP }],
  });
  await assert.rejects(
    () => service.create(userA, duplicateRoleDto),
    hasCode('SAVED_OUTFIT_DUPLICATE_ROLE'),
  );

  const duplicateProductDto = await toValidatedDto({
    ...validPayload(),
    items: [validItems()[0], { ...validItems()[1], productId: TOP_ID, variantId: undefined }],
  });
  await assert.rejects(
    () => service.create(userA, duplicateProductDto),
    hasCode('SAVED_OUTFIT_DUPLICATE_PRODUCT'),
  );

  const unavailableProductDto = await toValidatedDto({
    ...validPayload(),
    items: [{ ...validItems()[0], productId: UNAVAILABLE_ID, variantId: undefined }],
  });
  await assert.rejects(
    () => service.create(userA, unavailableProductDto),
    hasCode('SAVED_OUTFIT_PRODUCT_UNAVAILABLE'),
  );

  const unavailableVariantDto = await toValidatedDto({
    ...validPayload(),
    items: [{ ...validItems()[0], variantId: UNAVAILABLE_VARIANT_ID }],
  });
  await assert.rejects(
    () => service.create(userA, unavailableVariantDto),
    hasCode('SAVED_OUTFIT_VARIANT_UNAVAILABLE'),
  );

  await Promise.all([
    assertInvalidDto({ ...validPayload(), items: [] }, 'empty items'),
    assertInvalidDto(
      {
        ...validPayload(),
        items: [
          ...validItems(),
          ...EXTRA_IDS.map((productId, index) => ({
            ...validItems()[0],
            role: SavedOutfitItemRole.ACCESSORY,
            productId,
            variantId: undefined,
            productSlugSnapshot: `extra-${index}`,
          })),
        ],
      },
      'too many items',
    ),
    assertInvalidDto({ ...validPayload(), locale: 'fr' }, 'invalid locale'),
    assertInvalidDto(
      {
        ...validPayload(),
        items: [{ ...validItems()[0], role: 'dress' }],
      },
      'invalid role',
    ),
    assertInvalidDto(
      {
        ...validPayload(),
        items: [{ ...validItems()[0], quantity: 2 }],
      },
      'invalid quantity',
    ),
    assertInvalidDto(
      { ...validPayload(), totalPriceSnapshot: 1 },
      'client total field',
    ),
  ]);

  const removed = await service.remove(userA, created.savedOutfit.id);
  assert.deepEqual(removed, { deleted: true, id: created.savedOutfit.id });
  await assert.rejects(
    () => service.get(userA, created.savedOutfit.id),
    hasCode('SAVED_OUTFIT_NOT_FOUND'),
  );
  const afterDelete = await service.list(userA);
  assert.equal(
    afterDelete.savedOutfits.some((outfit) => outfit.id === created.savedOutfit.id),
    false,
  );

  assert.deepEqual(fixture.commerceMutations, {
    cart: 0,
    order: 0,
    payment: 0,
  });
  const serviceSource = readFileSync(
    resolve(process.cwd(), 'src/saved-outfits/saved-outfits.service.ts'),
    'utf8',
  );
  assert.equal(
    /prismaService\.(?:cart|order|payment)|checkout/i.test(serviceSource),
    false,
  );

  console.log(
    JSON.stringify(
      {
        verdict: 'PASS',
        cases: {
          customerOnlyGuards: 'PASS',
          validThreeItemSaveAndBackendTotal: 'PASS',
          listOwnerOnlyNewestFirst: 'PASS',
          detailOwnerOnly: 'PASS',
          deleteOwnerOnly: 'PASS',
          duplicateRoleRejected: 'PASS',
          duplicateProductRejected: 'PASS',
          itemBoundsRejected: 'PASS',
          invalidLocaleRoleQuantityRejected: 'PASS',
          unavailableProductRejected: 'PASS',
          unavailableVariantRejected: 'PASS',
          clientTotalRejected: 'PASS',
          noCartCheckoutOrderPaymentMutation: 'PASS',
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
