import { AiQuotaService } from '../src/ai/ai-quota.service';
import { AiScopeService } from '../src/ai/ai-scope.service';
import { AiService } from '../src/ai/ai.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  StyleAdviceRequestDto,
  type StyleAdviceOutfitProductRole,
  type StyleAdviceResponseDto,
} from '../src/ai/dto/style-advice.dto';
import { OutfitRecommendationService } from '../src/ai/outfit-recommendation.service';
import { PrismaService } from '../src/prisma/prisma.service';

type OutfitRole = StyleAdviceOutfitProductRole;

const PRODUCT_FIXTURES = [
  buildProduct('top-1', 'Black Oversized Tee', 'black-oversized-tee', 180_000, [
    'top', 'tee', 'black', 'streetwear', 'gothic', 'darkwear', 'oversized',
  ]),
  buildProduct('top-2', 'Cream Clean Tee', 'cream-clean-tee', 140_000, [
    'top', 'tee', 'cream', 'minimal', 'clean_fit', 'casual', 'coffee',
  ]),
  buildProduct('top-3', 'Budget Black Tee', 'budget-black-tee', 100_000, [
    'top', 'tee', 'black', 'gothic', 'darkwear', 'streetwear',
  ]),
  buildProduct('bottom-1', 'Black Gothic Jeans', 'black-gothic-jeans', 210_000, [
    'bottom', 'bottoms', 'pants', 'jeans', 'black', 'denim', 'gothic', 'darkwear',
  ]),
  buildProduct('bottom-2', 'Black Street Pants', 'black-street-pants', 150_000, [
    'bottom', 'bottoms', 'pants', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('bottom-3', 'Cream Cafe Jeans', 'cream-cafe-jeans', 120_000, [
    'bottom', 'bottoms', 'pants', 'jeans', 'cream', 'denim', 'coffee', 'casual',
  ]),
  buildProduct('shoes-1', 'Black Street Sneakers', 'black-street-sneakers', 190_000, [
    'shoes', 'sneakers', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('shoes-2', 'Black Gothic Boots', 'black-gothic-boots', 170_000, [
    'shoes', 'boots', 'black', 'gothic', 'darkwear', 'avant_garde',
  ]),
  buildProduct('shoes-3', 'Budget Black Boots', 'budget-black-boots', 110_000, [
    'shoes', 'boots', 'black', 'gothic', 'darkwear', 'streetwear',
  ]),
  buildProduct('shoes-4', 'Cream Cafe Sneakers', 'cream-cafe-sneakers', 100_000, [
    'shoes', 'sneakers', 'cream', 'coffee', 'casual', 'minimal',
  ]),
  buildProduct('jacket-1', 'Black Gothic Jacket', 'black-gothic-jacket', 160_000, [
    'jacket', 'outerwear', 'black', 'gothic', 'darkwear',
  ]),
  buildProduct('accessory-1', 'Silver Gothic Ring', 'silver-gothic-ring', 80_000, [
    'accessory', 'accessories', 'silver', 'silver_hardware', 'gothic', 'darkwear',
  ]),
  buildProduct('bag-1', 'Black Gothic Bag', 'black-gothic-bag', 90_000, [
    'handbag', 'bag', 'black', 'gothic', 'darkwear',
  ]),
] as const;

const prismaService = {
  product: { findMany: async () => PRODUCT_FIXTURES },
} as unknown as PrismaService;
const quotaService = {
  acquire: async () => ({ lockKey: 'refinement-smoke', lockToken: 'smoke' }),
  release: async () => undefined,
} as unknown as AiQuotaService;
const scopeService = new AiScopeService();
const aiService = new AiService(
  scopeService,
  quotaService,
  new OutfitRecommendationService(prismaService),
);
const failures: string[] = [];

async function run() {
  await verifyRequestValidation();

  const initialStreetwear = await generate(
    'Tui mu\u1ed1n outfit streetwear c\u00f3 \u00e1o thun \u0111en form r\u1ed9ng.',
  );
  const initialGothic = await generate(
    'I want an all black gothic outfit for going out.',
  );
  const initialCafe = await generate(
    'Tui mu\u1ed1n outfit \u0111i cafe m\u00e0u kem v\u1edbi qu\u1ea7n jeans t\u1ea7m 500k.',
  );

  check(initialStreetwear.outfits.length > 0, 'Initial streetwear result was empty');
  check(initialGothic.outfits.length === 2, 'Initial gothic result did not provide option 2');
  check(initialCafe.outfits.length > 0, 'Initial cafe result was empty');

  await verifyRefinement(
    'Tui th\u00edch option 1 nh\u01b0ng \u0111\u1ed5i qu\u1ea7n kh\u00e1c.',
    initialStreetwear,
    {
      locale: 'vi',
      action: 'replace',
      sourceOptionIndex: 1,
      targetRoles: ['bottom'],
      replacedRole: 'bottom',
    },
  );
  await verifyRefinement(
    'Gi\u1eef \u00e1o c\u1ee7a option 1 nh\u01b0ng \u0111\u1ed5i gi\u00e0y sang boots.',
    initialGothic,
    {
      locale: 'vi',
      action: 'replace',
      sourceOptionIndex: 1,
      targetRoles: ['top', 'shoes'],
      keptRole: 'top',
      replacedRole: 'shoes',
      replacementSlugIncludes: 'boots',
    },
  );
  await verifyRefinement(
    'Option 2 \u0111\u1eb9p nh\u01b0ng b\u1ecf jacket.',
    initialGothic,
    {
      locale: 'vi',
      action: 'remove',
      sourceOptionIndex: 2,
      targetRoles: ['jacket'],
      removedRole: 'jacket',
    },
  );
  await verifyRefinement(
    'Thay ph\u1ee5 ki\u1ec7n b\u1eb1ng t\u00fai.',
    initialGothic,
    {
      locale: 'vi',
      action: 'replace',
      sourceOptionIndex: 1,
      targetRoles: ['accessory', 'handbag'],
      replacedRole: 'accessory',
      expectedRole: 'handbag',
    },
  );
  await verifyRefinement(
    'Make option 1 under 500k.',
    initialGothic,
    {
      locale: 'en',
      action: 'budget',
      sourceOptionIndex: 1,
      maxTotal: 500_000,
    },
  );
  await verifyRefinement(
    'Keep the top, change the pants to black.',
    initialStreetwear,
    {
      locale: 'en',
      action: 'replace',
      sourceOptionIndex: 1,
      targetRoles: ['top', 'bottom'],
      keptRole: 'top',
      replacedRole: 'bottom',
    },
  );
  await verifyRefinement(
    '\u0110\u1ed5i sang outfit r\u1ebb h\u01a1n nh\u01b0ng v\u1eabn gothic.',
    initialGothic,
    {
      locale: 'vi',
      action: 'budget',
      sourceOptionIndex: 1,
      cheaperThanSource: true,
      expectedStyle: 'gothic',
    },
  );
  await verifyRefinement(
    'Tui kh\u00f4ng th\u00edch gi\u00e0y \u0111\u00f3, \u0111\u1ed5i \u0111\u00f4i kh\u00e1c.',
    initialStreetwear,
    {
      locale: 'vi',
      action: 'replace',
      sourceOptionIndex: 1,
      targetRoles: ['shoes'],
      replacedRole: 'shoes',
    },
  );

  await verifyMissingContext(
    'Tui th\u00edch option 1 nh\u01b0ng \u0111\u1ed5i qu\u1ea7n.',
    'vi',
  );
  await verifyMissingContext(
    'Keep the top, change the pants to black.',
    'en',
  );

  const staleRequest = buildFollowUpRequest(
    'Keep the top, change the pants to black.',
    initialStreetwear,
  );
  const staleTop = staleRequest.previousOutfits?.[0]?.products.find(
    (product) => product.role === 'top',
  );
  if (staleTop) {
    staleTop.productId = 'inactive-or-sold-out-top';
  }
  const staleResponse = await aiService.getStyleAdvice(staleRequest, {
    userId: 'refinement-stale-product-smoke-user',
  });
  check(
    staleResponse.outfits.every((outfit) =>
      outfit.products.every(
        (product) => product.productId !== 'inactive-or-sold-out-top',
      ),
    ),
    'Stale previous product was kept in a refined outfit',
  );
  check(
    staleResponse.outfits[0]?.products.some((product) => product.role === 'top') ===
      true,
    'Unavailable required top was not replaced from the current fixture',
  );
  check(
    staleResponse.warnings.length > 0,
    'Unavailable previous product did not produce a localized warning',
  );
  report(
    'Keep the top, change the pants to black. [stale previous top]',
    true,
    staleResponse,
    'inactive-or-sold-out-top',
    undefined,
  );

  for (const prompt of [
    'tui c\u00f3 ng\u00e2n s\u00e1ch 500k',
    'No jacket, just tee, pants and shoes.',
    'Recommend darkwear with boots and silver accessories.',
    'Tui mu\u1ed1n outfit \u0111\u01a1n gi\u1ea3n m\u1eb7c h\u1eb1ng ng\u00e0y, kh\u00f4ng qu\u00e1 n\u1ed5i.',
    'What is the weather today?',
  ]) {
    const response = await generate(prompt);
    const noJacket = prompt.startsWith('No jacket');
    if (noJacket) {
      check(
        response.outfits.every((outfit) =>
          outfit.products.every((product) => product.role !== 'jacket'),
        ),
        `${JSON.stringify(prompt)} returned a jacket`,
      );
    }
    report(prompt, false, response, undefined, undefined);
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

async function verifyRequestValidation() {
  const contextProduct = { role: 'top', productId: 'top-1' };
  const tooManyOutfits = plainToInstance(StyleAdviceRequestDto, {
    notes: 'Change option 1.',
    previousOutfits: [1, 2, 3].map((optionIndex) => ({
      optionIndex,
      products: [contextProduct],
    })),
  });
  const tooManyProducts = plainToInstance(StyleAdviceRequestDto, {
    notes: 'Change option 1.',
    previousOutfits: [
      {
        optionIndex: 1,
        products: Array.from({ length: 7 }, (_, index) => ({
          role: 'top',
          productId: `top-${index}`,
        })),
      },
    ],
  });
  const unsafeNestedField = plainToInstance(StyleAdviceRequestDto, {
    notes: 'Change option 1.',
    previousOutfits: [
      {
        optionIndex: 1,
        products: [{ ...contextProduct, unsafeInternalField: 'not-allowed' }],
      },
    ],
  });
  const validationOptions = {
    forbidNonWhitelisted: true,
    whitelist: true,
  };

  check(
    (await validate(tooManyOutfits, validationOptions)).length > 0,
    'Request validation accepted more than two previous outfits',
  );
  check(
    (await validate(tooManyProducts, validationOptions)).length > 0,
    'Request validation accepted more than six products in a previous outfit',
  );
  check(
    (await validate(unsafeNestedField, validationOptions)).length > 0,
    'Request validation accepted an unknown nested context field',
  );
}

interface RefinementExpectation {
  action: 'replace' | 'remove' | 'keep' | 'budget' | 'fresh';
  cheaperThanSource?: boolean;
  expectedRole?: OutfitRole;
  expectedStyle?: string;
  keptRole?: OutfitRole;
  locale: 'vi' | 'en';
  maxTotal?: number;
  removedRole?: OutfitRole;
  replacedRole?: OutfitRole;
  replacementSlugIncludes?: string;
  sourceOptionIndex: number;
  targetRoles?: OutfitRole[];
}

async function verifyRefinement(
  prompt: string,
  previous: StyleAdviceResponseDto,
  expected: RefinementExpectation,
) {
  const source = previous.outfits[expected.sourceOptionIndex - 1];
  const oldRoleProduct = expected.replacedRole
    ? source?.products.find((product) => product.role === expected.replacedRole)
    : undefined;
  const keptRoleProduct = expected.keptRole
    ? source?.products.find((product) => product.role === expected.keptRole)
    : undefined;
  const response = await generate(prompt, previous);
  const outfit = response.outfits[0];
  const total = outfit?.products.reduce((sum, product) => sum + product.price, 0);
  const sourceTotal = source?.products.reduce((sum, product) => sum + product.price, 0);

  check(response.locale === expected.locale, `${JSON.stringify(prompt)} locale mismatch`);
  check(response.refinement?.applied === true, `${JSON.stringify(prompt)} did not apply refinement`);
  check(
    response.refinement?.sourceOptionIndex === expected.sourceOptionIndex,
    `${JSON.stringify(prompt)} source option mismatch`,
  );
  check(response.refinement?.action === expected.action, `${JSON.stringify(prompt)} action mismatch`);
  check(Boolean(outfit), `${JSON.stringify(prompt)} did not return a refined outfit`);

  for (const role of expected.targetRoles ?? []) {
    check(
      response.refinement?.targetRoles?.includes(role) === true,
      `${JSON.stringify(prompt)} target roles did not include ${role}`,
    );
  }

  if (oldRoleProduct) {
    check(
      outfit?.products.every((product) => product.productId !== oldRoleProduct.productId) === true,
      `${JSON.stringify(prompt)} reused the old ${expected.replacedRole} product`,
    );
    check(
      response.refinement?.removedProductIds?.includes(oldRoleProduct.productId) === true,
      `${JSON.stringify(prompt)} did not report the old product as removed`,
    );
  }
  if (keptRoleProduct) {
    check(
      outfit?.products.some((product) => product.productId === keptRoleProduct.productId) === true,
      `${JSON.stringify(prompt)} did not keep ${expected.keptRole}`,
    );
  }
  if (expected.removedRole) {
    check(
      outfit?.products.every((product) => product.role !== expected.removedRole) === true,
      `${JSON.stringify(prompt)} returned removed role ${expected.removedRole}`,
    );
  }
  if (expected.expectedRole) {
    check(
      outfit?.products.some((product) => product.role === expected.expectedRole) === true,
      `${JSON.stringify(prompt)} did not return ${expected.expectedRole}`,
    );
  }
  if (expected.replacementSlugIncludes) {
    check(
      outfit?.products.some(
        (product) =>
          product.role === expected.replacedRole &&
          product.productSlug.includes(expected.replacementSlugIncludes!),
      ) === true,
      `${JSON.stringify(prompt)} did not prioritize ${expected.replacementSlugIncludes}`,
    );
  }
  if (expected.maxTotal !== undefined) {
    check(
      total !== undefined && total <= expected.maxTotal,
      `${JSON.stringify(prompt)} total ${total} exceeded ${expected.maxTotal}`,
    );
  }
  if (expected.cheaperThanSource) {
    check(
      total !== undefined && sourceTotal !== undefined && total < sourceTotal,
      `${JSON.stringify(prompt)} did not reduce the outfit total`,
    );
  }
  if (expected.expectedStyle) {
    check(
      response.intent.styles.includes(expected.expectedStyle),
      `${JSON.stringify(prompt)} did not preserve ${expected.expectedStyle}`,
    );
  }

  verifySharedInvariants(prompt, response);
  report(prompt, true, response, oldRoleProduct?.productId, sourceTotal);
}

async function verifyMissingContext(prompt: string, locale: 'vi' | 'en') {
  const response = await generate(prompt);
  check(response.locale === locale, `${JSON.stringify(prompt)} missing-context locale mismatch`);
  check(response.refinement?.applied === false, `${JSON.stringify(prompt)} faked a refinement`);
  check(response.outfits.length === 0, `${JSON.stringify(prompt)} returned an outfit without context`);
  check(response.warnings.length > 0, `${JSON.stringify(prompt)} omitted the missing-context warning`);
  report(prompt, false, response, undefined, undefined);
}

async function generate(
  prompt: string,
  previous?: StyleAdviceResponseDto,
): Promise<StyleAdviceResponseDto> {
  const request: StyleAdviceRequestDto = previous
    ? buildFollowUpRequest(prompt, previous)
    : { notes: prompt };
  return aiService.getStyleAdvice(request, { userId: 'refinement-smoke-user' });
}

function buildFollowUpRequest(
  notes: string,
  previous: StyleAdviceResponseDto,
): StyleAdviceRequestDto {
  return {
    notes,
    previousOutfits: previous.outfits.slice(0, 2).map((outfit, index) => ({
      optionIndex: index + 1,
      title: outfit.title,
      totalPrice: outfit.products.reduce((sum, product) => sum + product.price, 0),
      locale: previous.locale,
      products: outfit.products.slice(0, 6).map((product) => ({
        role: product.role,
        productId: product.productId,
        productSlug: product.productSlug,
        productName: product.productName,
        price: product.price,
      })),
    })),
    previousIntent: previous.intent,
    ...(previous.budget !== undefined ? { previousBudget: previous.budget } : {}),
  };
}

function verifySharedInvariants(prompt: string, response: StyleAdviceResponseDto) {
  check(response.outfits.length <= 2, `${JSON.stringify(prompt)} returned more than two outfits`);
  for (const outfit of response.outfits) {
    const roles = outfit.products.map((product) => product.role);
    const ids = outfit.products.map((product) => product.productId);
    check(new Set(roles).size === roles.length, `${JSON.stringify(prompt)} returned duplicate roles`);
    check(new Set(ids).size === ids.length, `${JSON.stringify(prompt)} returned duplicate product IDs`);
    check(
      ids.every((id) => PRODUCT_FIXTURES.some((product) => product.id === id)),
      `${JSON.stringify(prompt)} returned a product outside the active in-stock fixture`,
    );
  }
}

function report(
  prompt: string,
  contextPresent: boolean,
  response: StyleAdviceResponseDto,
  oldProductId: string | undefined,
  sourceTotal: number | undefined,
) {
  const roleUniqueness = response.outfits.every((outfit) => {
    const roles = outfit.products.map((product) => product.role);
    return new Set(roles).size === roles.length;
  });
  const totalPrice = response.outfits[0]?.products.reduce(
    (sum, product) => sum + product.price,
    0,
  );
  const scope = scopeService.evaluateStyleAdvice({
    notes: prompt,
    preferredColors: [],
    preferredSizes: [],
  }).result;

  console.log(
    JSON.stringify({
      prompt,
      contextPresent,
      scope,
      locale: response.locale,
      refinementApplied: response.refinement?.applied ?? false,
      sourceOptionIndex: response.refinement?.sourceOptionIndex,
      action: response.refinement?.action,
      targetRoles: response.refinement?.targetRoles ?? [],
      keptProductIds: response.refinement?.keptProductIds ?? [],
      removedProductIds: response.refinement?.removedProductIds ?? [],
      replacedProductIds: response.refinement?.replacedProductIds ?? [],
      oldProductExcluded:
        oldProductId === undefined ||
        response.outfits.every((outfit) =>
          outfit.products.every((product) => product.productId !== oldProductId),
        ),
      outfitCount: response.outfits.length,
      totalPrice,
      sourceTotal,
      roleUniqueness,
      warnings: response.warnings,
      verdict: failures.length === 0 ? 'PASS' : 'CHECK_FAILURES',
    }),
  );
}

function check(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message);
  }
}

function buildProduct(
  id: string,
  name: string,
  slug: string,
  price: number,
  aiTags: string[],
) {
  return {
    aiTags,
    basePrice: price,
    category: { name: 'Catalog', slug: 'catalog' },
    id,
    imageUrls: [`https://example.com/${slug}.jpg`],
    managedImages: [],
    name,
    productCategories: [],
    slug,
    variants: [{ color: 'Black', priceOverride: null, size: 'M' }],
  };
}

void run();
