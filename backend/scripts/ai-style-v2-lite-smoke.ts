import { AiQuotaService } from '../src/ai/ai-quota.service';
import { AiScopeService } from '../src/ai/ai-scope.service';
import { AiService } from '../src/ai/ai.service';
import {
  type StyleAdviceRequestDto,
  type StyleAdviceOutfitProductRole,
  type StyleAdviceResponseDto,
} from '../src/ai/dto/style-advice.dto';
import { OutfitRecommendationService } from '../src/ai/outfit-recommendation.service';
import { PrismaService } from '../src/prisma/prisma.service';

const PRODUCT_FIXTURES = [
  buildProduct('top-1', 'Cream Oversized Tee', 'cream-oversized-tee', 150_000, [
    'top', 'tee', 'cream', 'black', 'streetwear', 'gothic', 'darkwear',
    'minimal', 'clean_fit', 'oversized', 'coffee', 'school',
  ]),
  buildProduct('top-2', 'Black Street Tee', 'black-street-tee', 120_000, [
    'top', 'tee', 'black', 'streetwear', 'gothic', 'darkwear', 'oversized',
  ]),
  buildProduct('top-3', 'Black Rib Long Sleeves', 'black-rib-long-sleeves', 130_000, [
    'top', 'long_sleeves', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('top-4', 'Black Rib Tank Top', 'black-rib-tank-top', 125_000, [
    'top', 'tank', 'tank_top', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('bottom-1', 'Cream Cafe Pants', 'cream-cafe-pants', 170_000, [
    'bottom', 'bottoms', 'pants', 'cream', 'minimal', 'clean_fit', 'coffee', 'school',
  ]),
  buildProduct('bottom-2', 'Black Gothic Pants', 'black-gothic-pants', 140_000, [
    'bottom', 'bottoms', 'pants', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('bottom-3', 'Black Denim Jeans', 'black-denim-jeans', 130_000, [
    'bottom', 'bottoms', 'pants', 'jeans', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('bottom-4', 'Black Flared Pants', 'black-flared-pants', 135_000, [
    'bottom', 'bottoms', 'pants', 'flared', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('shoes-1', 'Cream Cafe Sneakers', 'cream-cafe-sneakers', 160_000, [
    'shoes', 'sneakers', 'cream', 'minimal', 'clean_fit', 'coffee', 'school',
  ]),
  buildProduct('shoes-2', 'Black Gothic Boots', 'black-gothic-boots', 150_000, [
    'shoes', 'boots', 'black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('jacket-1', 'Black Gothic Jacket', 'black-gothic-jacket', 180_000, [
    'jacket', 'outerwear', 'black', 'gothic', 'darkwear',
  ]),
  buildProduct('jacket-4', 'Washed Cropped Jacket', 'washed-cropped-jacket', 175_000, [
    'jacket', 'outerwear', 'washed_black', 'streetwear', 'gothic', 'darkwear',
  ]),
  buildProduct('jacket-2', 'Midnight Rider Pants', 'midnight-rider-pants', 110_000, [
    'jacket', 'outerwear', 'bottom', 'pants', 'black', 'gothic', 'darkwear',
  ]),
  buildProduct(
    'jacket-3',
    'Decayed Denim Jacket',
    'decayed-denim-jacket',
    90_000,
    ['bottom', 'pants', 'jacket', 'outerwear', 'black', 'gothic', 'darkwear'],
    { name: 'Bottoms', slug: 'bottoms' },
  ),
  buildProduct('accessory-1', 'Silver Ring', 'silver-ring', 70_000, [
    'accessory', 'accessories', 'silver', 'silver_hardware', 'gothic', 'darkwear',
  ]),
  buildProduct('accessory-2', 'Black Chain Necklace', 'black-chain-necklace', 85_000, [
    'accessory', 'accessories', 'necklace', 'black', 'gothic', 'darkwear',
  ]),
] as const;

let catalogQueries = 0;
let quotaAcquisitions = 0;
const prismaService = {
  product: {
    findMany: async () => {
      catalogQueries += 1;
      return PRODUCT_FIXTURES;
    },
  },
} as unknown as PrismaService;
const quotaService = {
  acquire: async () => {
    quotaAcquisitions += 1;
    return { lockKey: 'v2-lite-smoke', lockToken: 'smoke' };
  },
  release: async () => undefined,
} as unknown as AiQuotaService;
const scopeService = new AiScopeService();
const aiService = new AiService(
  scopeService,
  quotaService,
  new OutfitRecommendationService(prismaService),
);
const failures: string[] = [];

const CLARIFICATION_CASES = [
  { prompt: '\u0111i ch\u01a1i', locale: 'vi' },
  { prompt: 'cho tui outfit', locale: 'vi' },
  { prompt: 'm\u1eb7c g\u00ec \u0111\u1eb9p', locale: 'vi' },
  { prompt: 'recommend outfit', locale: 'en', useMessage: true },
  { prompt: 'style me', locale: 'en' },
] as const;

const OUTFIT_CASES = [
  { prompt: '\u0111i cafe m\u00e0u kem d\u01b0\u1edbi 700k', locale: 'vi' },
  { prompt: 'all black gothic \u0111i ch\u01a1i t\u1ed1i' },
  { prompt: 'streetwear \u00e1o thun \u0111en form r\u1ed9ng v\u1edbi boots' },
  { prompt: 'outfit \u0111\u01a1n gi\u1ea3n \u0111i h\u1ecdc d\u01b0\u1edbi 500k', locale: 'vi', maxBudget: 500_000 },
  {
    prompt: 'outfit \u0111\u01a1n gi\u1ea3n \u0111i h\u1ecdc d\u01b0\u1edbi 300k',
    locale: 'vi',
    maxBudget: 300_000,
    forbiddenRoles: ['shoes', 'jacket', 'accessory', 'handbag'],
  },
  { prompt: 'No jacket, just tee, pants and shoes.', noJacket: true },
  { prompt: 'Recommend darkwear with boots and silver accessories.' },
] as const;

async function run() {
  for (const smokeCase of CLARIFICATION_CASES) {
    const catalogBefore = catalogQueries;
    const quotaBefore = quotaAcquisitions;
    const request: StyleAdviceRequestDto =
      'useMessage' in smokeCase && smokeCase.useMessage
      ? { message: smokeCase.prompt }
      : { notes: smokeCase.prompt };
    const response = await aiService.getStyleAdvice(request, {
      userId: 'v2-lite-clarification-smoke-user',
    });

    check(response.type === 'clarification', smokeCase.prompt, 'type was not clarification');
    check(response.locale === smokeCase.locale, smokeCase.prompt, `locale was ${response.locale}`);
    check(Boolean(response.clarificationQuestion), smokeCase.prompt, 'question was missing');
    check(
      (response.clarificationQuestion?.match(/\?/g) ?? []).length === 1,
      smokeCase.prompt,
      'response did not contain exactly one question',
    );
    check(response.outfit === undefined, smokeCase.prompt, 'canonical outfit was exposed');
    check(response.outfits.length === 0, smokeCase.prompt, 'legacy outfit was exposed');
    check(catalogQueries === catalogBefore, smokeCase.prompt, 'catalog was queried');
    check(quotaAcquisitions === quotaBefore, smokeCase.prompt, 'quota was acquired');
    report(smokeCase.prompt, response);
  }

  const outfitResponses = new Map<string, StyleAdviceResponseDto>();
  for (const smokeCase of OUTFIT_CASES) {
    const response = await aiService.getStyleAdvice(
      { notes: smokeCase.prompt },
      { userId: 'v2-lite-outfit-smoke-user' },
    );
    outfitResponses.set(smokeCase.prompt, response);
    verifyOutfitResponse(smokeCase.prompt, response);
    if ('locale' in smokeCase && smokeCase.locale) {
      check(response.locale === smokeCase.locale, smokeCase.prompt, `locale was ${response.locale}`);
    }
    if ('maxBudget' in smokeCase && smokeCase.maxBudget) {
      check(
        response.outfit !== undefined && response.outfit.totalPrice <= smokeCase.maxBudget,
        smokeCase.prompt,
        `total exceeded ${smokeCase.maxBudget}`,
      );
    }
    if ('noJacket' in smokeCase && smokeCase.noJacket) {
      check(
        response.outfit?.items.every((item) => item.role !== 'jacket') === true,
        smokeCase.prompt,
        'jacket was returned',
      );
    }
    if ('forbiddenRoles' in smokeCase && smokeCase.forbiddenRoles) {
      for (const role of smokeCase.forbiddenRoles) {
        check(
          response.outfit?.items.every((item) => item.role !== role) === true,
          smokeCase.prompt,
          `${role} was returned`,
        );
      }
    }
    report(smokeCase.prompt, response);
  }

  const streetwearPrompt = 'streetwear \u00e1o thun \u0111en form r\u1ed9ng v\u1edbi boots';
  const previous = outfitResponses.get(streetwearPrompt);
  if (!previous) {
    throw new Error('Missing streetwear source response');
  }
  const oldBottomId = previous.outfit?.items.find((item) => item.role === 'bottom')?.productId;
  const refinementPrompt = 'Tui th\u00edch option 1 nh\u01b0ng \u0111\u1ed5i qu\u1ea7n kh\u00e1c.';
  const refined = await aiService.getStyleAdvice(
    buildFollowUpRequest(refinementPrompt, previous),
    { userId: 'v2-lite-refinement-smoke-user' },
  );
  verifyOutfitResponse(refinementPrompt, refined);
  check(refined.refinement?.applied === true, refinementPrompt, 'refinement was not applied');
  check(
    oldBottomId !== undefined &&
      refined.outfit?.items.every((item) => item.productId !== oldBottomId) === true,
    refinementPrompt,
    'old bottom was not excluded',
  );
  for (const sourceItem of previous.outfit?.items ?? []) {
    if (sourceItem.role === 'bottom') continue;
    check(
      refined.outfit?.items.some((item) => item.productId === sourceItem.productId) === true,
      refinementPrompt,
      `non-target ${sourceItem.role} was not kept`,
    );
  }
  report(refinementPrompt, refined);

  const cafeSource = outfitResponses.get('\u0111i cafe m\u00e0u kem d\u01b0\u1edbi 700k');
  if (!cafeSource) {
    throw new Error('Missing cafe source response');
  }
  const oldShoesId = cafeSource.outfit?.items.find((item) => item.role === 'shoes')?.productId;
  const bootsPrompt = '\u0111\u1ed5i gi\u00e0y sang boots';
  const bootsRefined = await aiService.getStyleAdvice(
    buildFollowUpRequest(bootsPrompt, cafeSource),
    { userId: 'v2-lite-boots-refinement-smoke-user' },
  );
  verifyOutfitResponse(bootsPrompt, bootsRefined);
  check(
    oldShoesId !== undefined &&
      bootsRefined.outfit?.items.every((item) => item.productId !== oldShoesId) === true,
    bootsPrompt,
    'old shoes were not excluded',
  );
  check(
    bootsRefined.outfit?.items.some(
      (item) => item.role === 'shoes' && item.productSlug.includes('boots'),
    ) === true,
    bootsPrompt,
    'boots were not prioritized',
  );
  report(bootsPrompt, bootsRefined);

  const addJacketSource = await aiService.getStyleAdvice(
    {
      message: 'them ao khoac',
      currentOutfit: {
        items: [
          { role: 'top', productId: 'top-2' },
          { role: 'bottom', productId: 'bottom-2' },
          { role: 'shoes', productId: 'shoes-2' },
        ],
        intent: previous.intent,
        locale: 'vi',
      },
    },
    { userId: 'v2-lite-add-jacket-refinement-smoke-user' },
  );
  const addJacketPrompt = 'them ao khoac';
  verifyOutfitResponse(addJacketPrompt, addJacketSource);
  check(addJacketSource.refinement?.action === 'add', addJacketPrompt, 'action was not add');
  check(
    addJacketSource.outfit?.items.length === 4,
    addJacketPrompt,
    `expected 4 items, got ${addJacketSource.outfit?.items.length}`,
  );
  for (const productId of ['top-2', 'bottom-2', 'shoes-2']) {
    check(
      addJacketSource.outfit?.items.some((item) => item.productId === productId) === true,
      addJacketPrompt,
      `${productId} was not kept while adding jacket`,
    );
  }
  check(
    addJacketSource.outfit?.items.filter((item) => item.role === 'jacket').length === 1,
    addJacketPrompt,
    'expected exactly one jacket role',
  );
  check(
    addJacketSource.outfit?.items.some(
      (item) => item.role === 'bottom' && item.productSlug.includes('jacket'),
    ) === false,
    addJacketPrompt,
    'jacket-looking product was used as bottom',
  );
  report(addJacketPrompt, addJacketSource);

  for (const humanPrompt of [
    'tui muon them ao khoac',
    'them cho tui mot cai ao khoac',
    'them cho toi mot cai ao khoac',
  ]) {
    const humanizedAddJacketResponse = await aiService.getStyleAdvice(
      {
        message: humanPrompt,
        currentOutfit: {
          items: [
            { role: 'top', productId: 'top-2' },
            { role: 'bottom', productId: 'bottom-2' },
            { role: 'shoes', productId: 'shoes-2' },
          ],
          intent: previous.intent,
          locale: 'vi',
        },
      },
      { userId: 'v2-lite-humanized-add-jacket-smoke-user' },
    );
    verifyOutfitResponse(humanPrompt, humanizedAddJacketResponse);
    check(
      humanizedAddJacketResponse.refinement?.action === 'add',
      humanPrompt,
      'action was not add',
    );
    check(
      humanizedAddJacketResponse.refinement?.targetRoles?.includes('jacket') === true,
      humanPrompt,
      'jacket was not targeted',
    );
    check(
      humanizedAddJacketResponse.refinement?.targetRoles?.includes('handbag') === false,
      humanPrompt,
      'customer pronoun was interpreted as handbag',
    );
    check(
      humanizedAddJacketResponse.outfit?.items.some((item) => item.role === 'jacket') === true,
      humanPrompt,
      'jacket was not added',
    );
    report(humanPrompt, humanizedAddJacketResponse);
  }

  const removeJacketPrompt = 'bo ao khoac';
  const removeJacketResponse = await aiService.getStyleAdvice(
    {
      message: removeJacketPrompt,
      currentOutfit: {
        items: [
          { role: 'top', productId: 'top-2' },
          { role: 'bottom', productId: 'bottom-2' },
          { role: 'shoes', productId: 'shoes-2' },
          { role: 'jacket', productId: 'jacket-1' },
        ],
        intent: previous.intent,
        locale: 'vi',
      },
    },
    { userId: 'v2-lite-remove-jacket-refinement-smoke-user' },
  );
  verifyOutfitResponse(removeJacketPrompt, removeJacketResponse);
  check(
    removeJacketResponse.refinement?.action === 'remove',
    removeJacketPrompt,
    'action was not remove',
  );
  check(
    removeJacketResponse.outfit?.items.every((item) => item.role !== 'jacket') === true,
    removeJacketPrompt,
    'removed jacket was still returned',
  );
  const normalizedRemoveSummary = (removeJacketResponse.outfit?.summary ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  check(
    normalizedRemoveSummary.includes('ao khoac giup outfit') === false,
    removeJacketPrompt,
    'remove summary still praised the removed jacket',
  );
  report(removeJacketPrompt, removeJacketResponse);

  await verifyTargetedReplacement({
    expectedProductSlugIncludes: 'tank',
    prompt: 'doi thanh ao ba lo',
    sourceItems: [
      { role: 'top', productId: 'top-2' },
      { role: 'bottom', productId: 'bottom-2' },
      { role: 'shoes', productId: 'shoes-1' },
    ],
    targetRole: 'top',
  });

  await verifyTargetedReplacement({
    expectedProductSlugIncludes: 'flared',
    prompt: 'doi thanh quan ong loe',
    sourceItems: [
      { role: 'top', productId: 'top-2' },
      { role: 'bottom', productId: 'bottom-2' },
      { role: 'shoes', productId: 'shoes-1' },
    ],
    targetRole: 'bottom',
  });

  await verifyTargetedReplacement({
    expectedProductSlugIncludes: 'boots',
    prompt: 'doi thanh boots',
    sourceItems: [
      { role: 'top', productId: 'top-2' },
      { role: 'bottom', productId: 'bottom-2' },
      { role: 'shoes', productId: 'shoes-1' },
    ],
    targetRole: 'shoes',
  });

  await verifyGenericReplacement({
    prompt: 'doi ao khac',
    targetRole: 'top',
  });
  await verifyGenericReplacement({
    prompt: 'thay cai ao khac',
    targetRole: 'top',
  });
  await verifyGenericReplacement({
    prompt: 'ao khac',
    targetRole: 'top',
  });
  await verifyGenericReplacement({
    prompt: 'doi ao',
    targetRole: 'top',
  });
  await verifyGenericReplacement({
    prompt: 'change the top to another one',
    targetRole: 'top',
  });
  await verifyGenericReplacement({
    prompt: 'change the top',
    targetRole: 'top',
  });
  await verifyGenericReplacement({
    prompt: 'doi quan khac',
    targetRole: 'bottom',
  });
  await verifyGenericReplacement({
    prompt: 'thay cai quan khac',
    targetRole: 'bottom',
  });
  await verifyGenericReplacement({
    prompt: 'quan khac',
    targetRole: 'bottom',
  });
  await verifyGenericReplacement({
    prompt: 'doi quan',
    targetRole: 'bottom',
  });
  await verifyGenericReplacement({
    prompt: 'change the pants to another pair',
    targetRole: 'bottom',
  });
  await verifyGenericReplacement({
    prompt: 'replace pants',
    targetRole: 'bottom',
  });
  await verifyGenericReplacement({
    prompt: 'doi ao khoac khac',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'doi cai ao khoac khac',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'cho ao khoac khac',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'jacket khac',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'another jacket',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'đổi áo khoác khác',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'ao khoac khac',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'doi ao khoac',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'switch the jacket to a different one',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'switch the jacket',
    targetRole: 'jacket',
  });
  await verifyGenericReplacement({
    prompt: 'doi giay khac',
    targetRole: 'shoes',
  });
  await verifyGenericReplacement({
    prompt: 'giay khac',
    targetRole: 'shoes',
  });
  await verifyGenericReplacement({
    prompt: 'doi giay',
    targetRole: 'shoes',
  });
  await verifyGenericReplacement({
    prompt: 'swap the shoes for another pair',
    targetRole: 'shoes',
  });
  await verifyGenericReplacement({
    prompt: 'swap shoes',
    targetRole: 'shoes',
  });
  await verifyGenericReplacement({
    prompt: 'doi phu kien khac',
    targetRole: 'accessory',
  });
  await verifyGenericReplacement({
    prompt: 'phu kien khac',
    targetRole: 'accessory',
  });
  await verifyGenericReplacement({
    prompt: 'doi phu kien',
    targetRole: 'accessory',
  });
  await verifyGenericReplacement({
    prompt: 'change the accessory to a different one',
    targetRole: 'accessory',
  });
  await verifyGenericReplacement({
    prompt: 'change the accessory',
    targetRole: 'accessory',
  });

  const missingPrompt = '\u0111\u1ed5i qu\u1ea7n kh\u00e1c';
  const missing = await aiService.getStyleAdvice(
    { message: missingPrompt },
    { userId: 'v2-lite-missing-context-smoke-user' },
  );
  check(missing.type === 'clarification', missingPrompt, `type was ${missing.type}`);
  check(missing.outfit === undefined, missingPrompt, 'invented an outfit');
  check(missing.outfits.length === 0, missingPrompt, 'returned a legacy outfit');
  report(missingPrompt, missing);

  const legacyPrompt = '\u0111\u1ed5i qu\u1ea7n kh\u00e1c';
  const legacyRefined = await aiService.getStyleAdvice(
    buildLegacyFollowUpRequest(legacyPrompt, previous),
    { userId: 'v2-lite-legacy-context-smoke-user' },
  );
  verifyOutfitResponse(legacyPrompt, legacyRefined);
  check(legacyRefined.refinement?.applied === true, legacyPrompt, 'legacy context was not adapted');
  report(`${legacyPrompt} [legacy previousOutfits]`, legacyRefined);

  const outOfScopePrompt = 'What is the weather today?';
  const outOfScope = await aiService.getStyleAdvice(
    { notes: outOfScopePrompt },
    { userId: 'v2-lite-scope-smoke-user' },
  );
  check(outOfScope.type === 'out_of_scope', outOfScopePrompt, `type was ${outOfScope.type}`);
  check(outOfScope.outfit === undefined, outOfScopePrompt, 'canonical outfit was exposed');
  check(outOfScope.outfits.length === 0, outOfScopePrompt, 'legacy outfit was exposed');
  report(outOfScopePrompt, outOfScope);

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

async function verifyTargetedReplacement({
  expectedProductSlugIncludes,
  prompt,
  sourceItems,
  targetRole,
}: {
  expectedProductSlugIncludes: string;
  prompt: string;
  sourceItems: NonNullable<StyleAdviceRequestDto['currentOutfit']>['items'];
  targetRole: 'top' | 'bottom' | 'shoes';
}) {
  const oldProductId = sourceItems.find((item) => item.role === targetRole)?.productId;
  const response = await aiService.getStyleAdvice(
    {
      message: prompt,
      currentOutfit: {
        items: sourceItems,
        intent: {
          categories: ['tee', 'bottoms', 'shoes'],
          colors: ['black'],
          styles: ['streetwear'],
          occasions: [],
          fits: [],
          negativeConstraints: [],
        },
        locale: 'vi',
      },
    },
    { userId: `v2-lite-${targetRole}-targeted-replacement-smoke-user` },
  );

  verifyOutfitResponse(prompt, response);
  check(response.refinement?.action === 'replace', prompt, 'action was not replace');
  check(
    oldProductId !== undefined &&
      response.outfit?.items.every((item) => item.productId !== oldProductId) === true,
    prompt,
    `old ${targetRole} was not excluded`,
  );
  check(
    response.outfit?.items.some(
      (item) =>
        item.role === targetRole &&
        item.productSlug.includes(expectedProductSlugIncludes),
    ) === true,
    prompt,
    `${expectedProductSlugIncludes} was not prioritized for ${targetRole}`,
  );

  for (const sourceItem of sourceItems) {
    if (sourceItem.role === targetRole) continue;
    check(
      response.outfit?.items.some((item) => item.productId === sourceItem.productId) === true,
      prompt,
      `non-target ${sourceItem.role} was not kept`,
    );
  }

  report(prompt, response);
}

async function verifyGenericReplacement({
  prompt,
  targetRole,
}: {
  prompt: string;
  targetRole: Exclude<StyleAdviceOutfitProductRole, 'handbag'>;
}) {
  const sourceItems: NonNullable<StyleAdviceRequestDto['currentOutfit']>['items'] = [
    { role: 'top', productId: 'top-2' },
    { role: 'bottom', productId: 'bottom-2' },
    { role: 'shoes', productId: 'shoes-1' },
    { role: 'jacket', productId: 'jacket-1' },
    { role: 'accessory', productId: 'accessory-1' },
  ];
  const oldProductId = sourceItems.find((item) => item.role === targetRole)?.productId;
  const response = await aiService.getStyleAdvice(
    {
      message: prompt,
      currentOutfit: {
        items: sourceItems,
        intent: {
          categories: ['tee', 'bottoms', 'shoes', 'jacket', 'accessories'],
          colors: ['black'],
          styles: ['streetwear'],
          occasions: [],
          fits: [],
          negativeConstraints: [],
        },
        locale: prompt.includes('the ') ? 'en' : 'vi',
      },
    },
    { userId: `v2-lite-${targetRole}-generic-replacement-smoke-user` },
  );

  verifyOutfitResponse(prompt, response);
  check(response.refinement?.action === 'replace', prompt, 'action was not replace');
  check(
    response.refinement?.targetRoles?.includes(targetRole) === true,
    prompt,
    `${targetRole} was not a target role`,
  );
  check(
    oldProductId !== undefined &&
      response.outfit?.items.every((item) => item.productId !== oldProductId) === true,
    prompt,
    `old ${targetRole} was not excluded`,
  );

  for (const sourceItem of sourceItems) {
    if (sourceItem.role === targetRole) continue;
    check(
      response.outfit?.items.some((item) => item.productId === sourceItem.productId) === true,
      prompt,
      `non-target ${sourceItem.role} was not kept`,
    );
  }

  report(prompt, response);
}

function verifyOutfitResponse(prompt: string, response: StyleAdviceResponseDto) {
  const items = response.outfit?.items ?? [];
  const productIds = items.map((item) => item.productId);
  const roles = items.map((item) => item.role);
  check(response.type === 'outfit', prompt, `type was ${response.type}`);
  check(Boolean(response.outfit), prompt, 'canonical outfit was missing');
  check(response.outfits.length === 1, prompt, `legacy outfits length was ${response.outfits.length}`);
  check(new Set(productIds).size === productIds.length, prompt, 'duplicate canonical product IDs');
  check(new Set(roles).size === roles.length, prompt, 'duplicate canonical roles');
  check(roles.filter((role) => role === 'top').length === 1, prompt, 'expected exactly one top');
  check(roles.filter((role) => role === 'bottom').length === 1, prompt, 'expected exactly one bottom');
  check(
    items.every(
      (item) =>
        item.role === 'bottom' ||
        !/\b(?:pants?|trousers?|jeans?|denim|shorts?|skirts?)\b/.test(
          item.productSlug.replace(/-/g, ' '),
        ),
    ),
    prompt,
    'bottom-looking product was returned outside the bottom role',
  );
  check(
    items.every(
      (item) =>
        item.role === 'jacket' ||
        !/\b(?:jackets?|outerwear|coats?|blazers?|overshirts?|cardigans?|biker)\b/.test(
          item.productSlug.replace(/-/g, ' '),
        ),
    ),
    prompt,
    'jacket-looking product was returned outside the jacket role',
  );
  check(items.every((item) => item.variantRequired), prompt, 'variantRequired was not safe');
  check(
    response.outfits[0]?.products.map((product) => product.productId).join(',') === productIds.join(','),
    prompt,
    'canonical and compatibility outfits diverged',
  );
}

function buildFollowUpRequest(
  message: string,
  previous: StyleAdviceResponseDto,
): StyleAdviceRequestDto {
  return {
    message,
    currentOutfit: {
      items: (previous.outfit?.items ?? []).map((item) => ({
        role: item.role,
        productId: item.productId,
      })),
      intent: previous.intent,
      ...(previous.budget !== undefined ? { budget: previous.budget } : {}),
      ...(previous.locale ? { locale: previous.locale } : {}),
    },
  };
}

function buildLegacyFollowUpRequest(
  message: string,
  previous: StyleAdviceResponseDto,
): StyleAdviceRequestDto {
  return {
    message,
    previousOutfits: previous.outfits.slice(0, 1).map((outfit) => ({
      optionIndex: 1,
      title: outfit.title,
      totalPrice: outfit.products.reduce((total, product) => total + product.price, 0),
      locale: previous.locale,
      products: outfit.products.map((product) => ({
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

function report(prompt: string, response: StyleAdviceResponseDto) {
  const productIds = response.outfit?.items.map((item) => item.productId) ?? [];
  const roles = response.outfit?.items.map((item) => item.role) ?? [];
  console.log(JSON.stringify({
    prompt,
    scope: scopeService.evaluateStyleAdvice({
      notes: prompt,
      preferredColors: [],
      preferredSizes: [],
    }).result,
    locale: response.locale,
    type: response.type,
    clarificationQuestion: response.clarificationQuestion,
    canonicalOutfitExists: Boolean(response.outfit),
    legacyOutfitsLength: response.outfits.length,
    productIds,
    roles,
    duplicateRoles: new Set(roles).size !== roles.length,
    duplicateProductIds: new Set(productIds).size !== productIds.length,
    warnings: response.outfit?.warnings ?? response.warnings,
    verdict: failures.length === 0 ? 'PASS' : 'CHECK_FAILURES',
  }));
}

function check(condition: boolean, prompt: string, message: string) {
  if (!condition) failures.push(`${JSON.stringify(prompt)}: ${message}`);
}

function buildProduct(
  id: string,
  name: string,
  slug: string,
  price: number,
  aiTags: string[],
  category = { name: 'Catalog', slug: 'catalog' },
) {
  return {
    aiTags,
    basePrice: price,
    category,
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
