import { AiQuotaService } from '../src/ai/ai-quota.service';
import {
  AiScopeService,
  type AiScopeResult,
} from '../src/ai/ai-scope.service';
import { AiService } from '../src/ai/ai.service';
import type { StyleAdviceIntentDto } from '../src/ai/dto/style-advice.dto';
import { OutfitRecommendationService } from '../src/ai/outfit-recommendation.service';
import { PrismaService } from '../src/prisma/prisma.service';

type OutfitRole = 'top' | 'bottom' | 'shoes' | 'jacket' | 'handbag' | 'accessory';

interface IntentExpectation {
  categories?: string[];
  colors?: string[];
  fits?: string[];
  negativeConstraints?: string[];
  occasions?: string[];
  styles?: string[];
}

interface IntentSmokeCase {
  expectedIntent?: IntentExpectation;
  expectedLocale?: 'vi' | 'en';
  expectedScope: AiScopeResult;
  forbiddenRoles?: OutfitRole[];
  prompt: string;
  verifyBudgetWarning?: boolean;
}

const PRODUCT_FIXTURES = [
  buildProduct('top-1', 'Original Clean Tee', 'original-clean-tee', 210_000, [
    'top',
    'tee',
    'black',
    'blue',
    'minimal',
    'clean_fit',
    'casual',
    'daily_wear',
    'coffee',
    'streetwear',
    'darkwear',
    'oversized',
  ]),
  buildProduct('bottom-1', 'Original Denim Pants', 'original-denim-pants', 230_000, [
    'bottoms',
    'pants',
    'jeans',
    'denim',
    'blue',
    'washed_blue',
    'black',
    'minimal',
    'clean_fit',
    'casual',
    'daily_wear',
    'coffee',
    'streetwear',
    'darkwear',
  ]),
  buildProduct('shoes-1', 'Original Black Boots', 'original-black-boots', 190_000, [
    'shoes',
    'boots',
    'black',
    'minimal',
    'clean_fit',
    'casual',
    'daily_wear',
    'coffee',
    'streetwear',
    'darkwear',
    'avant_garde',
  ]),
  buildProduct('jacket-1', 'Original Dark Jacket', 'original-dark-jacket', 260_000, [
    'jacket',
    'outerwear',
    'black',
    'gothic',
    'darkwear',
    'avant_garde',
  ]),
  buildProduct('accessory-1', 'Original Silver Ring', 'original-silver-ring', 90_000, [
    'accessory',
    'accessories',
    'ring',
    'silver',
    'silver_hardware',
    'gothic',
    'darkwear',
  ]),
  buildProduct('bag-1', 'Original Black Bag', 'original-black-bag', 120_000, [
    'handbag',
    'bag',
    'black',
    'minimal',
    'darkwear',
  ]),
] as const;

const CASES: IntentSmokeCase[] = [
  {
    prompt: 'Tui muốn outfit đơn giản mặc hằng ngày, không quá nổi.',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    expectedIntent: {
      styles: ['minimal', 'casual', 'clean_fit'],
      occasions: ['daily_wear'],
      negativeConstraints: ['too_loud'],
    },
  },
  {
    prompt: 'Tui muốn outfit màu xanh đi cafe.',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    expectedIntent: { colors: ['blue'], occasions: ['coffee'] },
  },
  {
    prompt: 'Tui muốn outfit không áo khoác.',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    expectedIntent: { negativeConstraints: ['no_jacket'] },
    forbiddenRoles: ['jacket'],
  },
  {
    prompt: 'Tui muốn outfit không phụ kiện.',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    expectedIntent: { negativeConstraints: ['no_accessory'] },
    forbiddenRoles: ['accessory'],
  },
  {
    prompt: 'Tui muốn outfit không túi.',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    expectedIntent: { negativeConstraints: ['no_handbag'] },
    forbiddenRoles: ['handbag'],
  },
  {
    prompt: 'Recommend Rick Owens style darkwear with boots.',
    expectedScope: 'allowed',
    expectedLocale: 'en',
    expectedIntent: {
      styles: ['rick_owens_style', 'darkwear'],
      categories: ['shoes'],
    },
  },
  {
    prompt: 'I want a clean basic everyday outfit, not too flashy.',
    expectedScope: 'allowed',
    expectedLocale: 'en',
    expectedIntent: {
      styles: ['clean_fit', 'minimal'],
      occasions: ['daily_wear'],
      negativeConstraints: ['too_loud'],
    },
  },
  {
    prompt: 'Tui thích option 1 nhưng đổi quần.',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    expectedIntent: { categories: ['bottoms'] },
  },
  {
    prompt: 'Keep the top, change the pants to black.',
    expectedScope: 'allowed',
    expectedLocale: 'en',
    expectedIntent: { categories: ['top', 'bottoms'], colors: ['black'] },
  },
  {
    prompt: 'tui có ngân sách 500k',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    verifyBudgetWarning: true,
  },
  {
    prompt: 'No jacket, just tee, pants and shoes.',
    expectedScope: 'allowed',
    expectedLocale: 'en',
    expectedIntent: {
      categories: ['tee', 'bottoms', 'shoes'],
      negativeConstraints: ['no_jacket'],
    },
    forbiddenRoles: ['jacket'],
  },
  {
    prompt: 'Recommend darkwear with boots and silver accessories.',
    expectedScope: 'allowed',
    expectedLocale: 'en',
    expectedIntent: {
      categories: ['shoes', 'accessories'],
      colors: ['silver'],
      styles: ['darkwear'],
    },
  },
  {
    prompt: 'Cho tui outfit streetwear có áo thun đen form rộng.',
    expectedScope: 'allowed',
    expectedLocale: 'vi',
    expectedIntent: {
      categories: ['tee'],
      colors: ['black'],
      styles: ['streetwear'],
      fits: ['oversized'],
    },
  },
  { prompt: 'What is the weather today?', expectedScope: 'out_of_scope' },
  { prompt: 'Explain JavaScript promises.', expectedScope: 'out_of_scope' },
  { prompt: 'What is 2 + 2?', expectedScope: 'out_of_scope' },
  { prompt: 'Write me a database migration.', expectedScope: 'out_of_scope' },
  {
    prompt: 'How do I pay my electricity bill?',
    expectedScope: 'out_of_scope',
  },
];

const prismaService = {
  product: { findMany: async () => PRODUCT_FIXTURES },
} as unknown as PrismaService;
const quotaService = {
  acquire: async () => ({ lockKey: 'intent-smoke', lockToken: 'intent-smoke' }),
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
  for (const smokeCase of CASES) {
    const failureCountBefore = failures.length;
    const request = {
      notes: smokeCase.prompt,
      preferredColors: [],
      preferredSizes: [],
    };
    const scopeDecision = scopeService.evaluateStyleAdvice(request);
    const response = await aiService.getStyleAdvice(
      { notes: smokeCase.prompt },
      { userId: 'intent-smoke-user' },
    );
    const roles = response.outfits.flatMap((outfit) =>
      outfit.products.map((product) => product.role),
    );
    const roleUniqueness = response.outfits.every((outfit) => {
      const outfitRoles = outfit.products.map((product) => product.role);
      return new Set(outfitRoles).size === outfitRoles.length;
    });

    check(
      scopeDecision.result === smokeCase.expectedScope,
      smokeCase,
      `expected scope ${smokeCase.expectedScope}, received ${scopeDecision.result}`,
    );

    if (smokeCase.expectedLocale) {
      check(
        response.locale === smokeCase.expectedLocale,
        smokeCase,
        `expected locale ${smokeCase.expectedLocale}, received ${response.locale}`,
      );
    }

    if (smokeCase.expectedScope === 'allowed') {
      check(response.mode === 'deterministic_tag_recommender', smokeCase, 'allowed prompt did not use deterministic recommender');
      check(response.outfits.length <= 2, smokeCase, 'returned more than two outfits');
      check(roleUniqueness, smokeCase, 'returned duplicate roles within an outfit');
      checkIntent(response.intent, smokeCase.expectedIntent, smokeCase);

      for (const forbiddenRole of smokeCase.forbiddenRoles ?? []) {
        check(
          !roles.includes(forbiddenRole),
          smokeCase,
          `returned forbidden role ${forbiddenRole}`,
        );
      }

      if (smokeCase.verifyBudgetWarning) {
        check(
          response.warnings.some((warning) => warning.includes('500')),
          smokeCase,
          'did not preserve the closest-over-budget warning',
        );
      }
    } else {
      check(response.mode === 'out_of_scope', smokeCase, 'out-of-scope prompt was not safely rejected');
      check(response.outfits.length === 0, smokeCase, 'out-of-scope prompt returned outfits');
    }

    const verdict = failures.length === failureCountBefore ? 'PASS' : 'FAIL';
    console.log(
      JSON.stringify({
        prompt: smokeCase.prompt,
        scopeResult: scopeDecision.result,
        locale: response.locale,
        extractedColors: response.intent.colors,
        extractedStyles: response.intent.styles,
        extractedCategories: response.intent.categories,
        extractedOccasions: response.intent.occasions,
        extractedFits: response.intent.fits,
        extractedNegativeConstraints: response.intent.negativeConstraints,
        outfitCount: response.outfits.length,
        roleUniqueness,
        warningBehavior: response.warnings,
        verdict,
      }),
    );
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

function checkIntent(
  intent: StyleAdviceIntentDto,
  expected: IntentExpectation | undefined,
  smokeCase: IntentSmokeCase,
) {
  if (!expected) {
    return;
  }

  for (const field of [
    'categories',
    'colors',
    'styles',
    'occasions',
    'fits',
    'negativeConstraints',
  ] as const) {
    for (const expectedValue of expected[field] ?? []) {
      check(
        intent[field].includes(expectedValue),
        smokeCase,
        `expected ${field} to include ${expectedValue}; received ${JSON.stringify(intent[field])}`,
      );
    }
  }
}

function check(
  condition: boolean,
  smokeCase: IntentSmokeCase,
  message: string,
) {
  if (!condition) {
    failures.push(`${JSON.stringify(smokeCase.prompt)}: ${message}`);
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
