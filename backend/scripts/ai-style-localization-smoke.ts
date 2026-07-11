import { AiQuotaService } from '../src/ai/ai-quota.service';
import { AiScopeService } from '../src/ai/ai-scope.service';
import { AiService } from '../src/ai/ai.service';
import { OutfitRecommendationService } from '../src/ai/outfit-recommendation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { detectStyleAdviceLocale } from '../src/ai/style-advice-locale';

const PRODUCT_FIXTURES = [
  buildProduct('top-1', 'Original Cream Black Tee', 'original-cream-black-tee', 210_000, [
    'tee',
    'cream',
    'black',
    'streetwear',
    'gothic',
    'minimal',
    'clean_fit',
    'casual',
    'oversized',
    'coffee',
    'daily_wear',
  ]),
  buildProduct('bottom-1', 'Original Denim Jeans', 'original-denim-jeans', 230_000, [
    'bottoms',
    'pants',
    'denim',
    'blue',
    'black',
    'streetwear',
    'gothic',
    'minimal',
    'clean_fit',
    'casual',
    'coffee',
    'daily_wear',
  ]),
  buildProduct('shoes-1', 'Original Everyday Shoes', 'original-everyday-shoes', 190_000, [
    'shoes',
    'cream',
    'black',
    'streetwear',
    'gothic',
    'minimal',
    'clean_fit',
    'casual',
    'coffee',
    'daily_wear',
  ]),
  buildProduct('jacket-1', 'Original Gothic Jacket', 'original-gothic-jacket', 260_000, [
    'jacket',
    'black',
    'gothic',
    'darkwear',
  ]),
  buildProduct('accessory-1', 'Original Silver Ring', 'original-silver-ring', 90_000, [
    'accessory',
    'silver',
    'gothic',
  ]),
] as const;

const REQUIRED_CASES = [
  { locale: 'vi', prompt: 'Tui muốn outfit đi cafe màu kem với quần jeans.' },
  { locale: 'vi', prompt: 'tui có ngân sách 500k' },
  { locale: 'vi', prompt: 'Cho tui outfit streetwear có áo thun đen form rộng.' },
  {
    locale: 'vi',
    prompt: 'Tui muốn outfit đơn giản mặc hằng ngày, không quá nổi.',
  },
  {
    locale: 'en',
    prompt: 'I want a clean casual outfit with cream top and jeans.',
  },
  {
    locale: 'en',
    prompt: 'I want an all black gothic outfit for going out.',
  },
  { locale: 'en', prompt: 'No jacket, just tee, pants and shoes.' },
] as const;

const prismaService = {
  product: {
    findMany: async () => PRODUCT_FIXTURES,
  },
} as unknown as PrismaService;
const quotaService = {
  acquire: async () => ({ lockKey: 'smoke', lockToken: 'smoke' }),
  release: async () => undefined,
} as unknown as AiQuotaService;
const recommender = new OutfitRecommendationService(prismaService);
const aiService = new AiService(
  new AiScopeService(),
  quotaService,
  recommender,
);
const failures: string[] = [];
const fixtureNames = new Set(PRODUCT_FIXTURES.map((product) => product.name));

async function run() {
  for (const smokeCase of REQUIRED_CASES) {
    const response = await aiService.getStyleAdvice(
      { notes: smokeCase.prompt },
      { userId: 'localization-smoke-user' },
    );
    const customerText = [
      response.summary,
      ...response.outfits.flatMap((outfit) => [
        outfit.title,
        outfit.reason,
        ...outfit.warnings,
      ]),
      ...response.warnings,
      ...response.extraTips,
    ].join(' ');

    check(
      response.locale === smokeCase.locale,
      `${JSON.stringify(smokeCase.prompt)} expected locale ${smokeCase.locale}, received ${response.locale}`,
    );
    check(
      response.outfits.length === 1,
      `${JSON.stringify(smokeCase.prompt)} did not return exactly one outfit`,
    );
    checkLocalizedText(customerText, smokeCase.locale, smokeCase.prompt);

    for (const outfit of response.outfits) {
      const roles = outfit.products.map((product) => product.role);
      check(
        new Set(roles).size === roles.length,
        `${JSON.stringify(smokeCase.prompt)} returned duplicate outfit roles`,
      );

      for (const product of outfit.products) {
        check(
          fixtureNames.has(product.productName),
          `${JSON.stringify(smokeCase.prompt)} changed product name ${JSON.stringify(product.productName)}`,
        );
      }
    }

    if (smokeCase.prompt.startsWith('No jacket')) {
      check(
        response.outfits.every((outfit) =>
          outfit.products.every((product) => product.role !== 'jacket'),
        ),
        'The no-jacket prompt returned a jacket',
      );
    }

    console.log(
      `locale=${response.locale} outfits=${response.outfits.length} prompt=${JSON.stringify(smokeCase.prompt)}`,
    );
  }

  await checkBudgetWarning('tui có ngân sách 500k', 'vi');
  await checkBudgetWarning('I want a clean outfit under 500k.', 'en');

  check(
    detectStyleAdviceLocale('Minimal streetwear cho tui áo đen form rộng') ===
      'vi',
    'Dominant mixed Vietnamese prompt did not resolve to vi',
  );
  check(
    detectStyleAdviceLocale('I want a black outfit with áo') === 'en',
    'Weak Vietnamese signal should keep the English default',
  );
  check(
    detectStyleAdviceLocale('Tui want an all black outfit') === 'vi',
    'Natural Vietnamese opening should resolve to vi',
  );

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

async function checkBudgetWarning(
  prompt: string,
  locale: 'vi' | 'en',
) {
  const response = await aiService.getStyleAdvice(
    { notes: prompt },
    { userId: 'localization-budget-smoke-user' },
  );
  const warningText = response.warnings.join(' ');
  const total = response.outfits[0]?.products.reduce(
    (sum, product) => sum + product.price,
    0,
  );

  check(response.locale === locale, `${JSON.stringify(prompt)} locale mismatch`);
  check(
    total !== undefined && total > 500_000,
    `${JSON.stringify(prompt)} did not return the closest complete over-budget outfit`,
  );
  check(
    warningText.includes('500'),
    `${JSON.stringify(prompt)} did not return the closest-over-budget warning`,
  );
  checkLocalizedText(warningText, locale, prompt);
}

function checkLocalizedText(
  text: string,
  locale: 'vi' | 'en',
  prompt: string,
) {
  if (locale === 'vi') {
    check(
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
        text,
      ),
      `${JSON.stringify(prompt)} did not return accented Vietnamese customer text`,
    );
    return;
  }

  check(
    !/\b(?:Mình|Gợi ý|Không tìm|Bạn có thể|Set này)\b/i.test(text),
    `${JSON.stringify(prompt)} returned Vietnamese customer text for English locale`,
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
