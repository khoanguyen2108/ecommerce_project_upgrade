import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { NormalizedStyleAdviceRequest } from './dto/style-advice.dto';
import type {
  StyleAdviceIntentDto,
  StyleAdviceOutfitDto,
  StyleAdviceOutfitProductDto,
  StyleAdviceRecommendationDto,
} from './dto/style-advice.dto';

type OutfitRole = 'top' | 'bottom' | 'shoes' | 'jacket' | 'handbag' | 'accessory';

interface DictionaryEntry {
  tag: string;
  aliases: string[];
  impliedTags?: string[];
}

interface CategoryDictionaryEntry extends DictionaryEntry {
  role: OutfitRole;
}

interface ExtractedIntent {
  categories: string[];
  colors: string[];
  styles: string[];
  occasions: string[];
  fits: string[];
  negativeCategories: OutfitRole[];
  negativeTags: string[];
  searchTags: string[];
}

interface ProductVariantRecord {
  color: string;
  priceOverride: number | null;
  size: string;
}

interface OutfitProductRecord {
  aiTags: string[];
  basePrice: number;
  category: {
    name: string;
    slug: string;
  };
  id: string;
  imageUrls: string[];
  managedImages: Array<{
    imageAsset: {
      publicUrl: string;
    };
  }>;
  name: string;
  productCategories: Array<{
    category: {
      name: string;
      slug: string;
    };
  }>;
  slug: string;
  variants: ProductVariantRecord[];
}

interface PreparedProduct {
  categoryTags: Set<string>;
  imageUrl?: string;
  price: number;
  record: OutfitProductRecord;
  roles: Set<OutfitRole>;
  tagSet: Set<string>;
  variantColorTags: Set<string>;
}

interface ScoredProduct {
  intentScore: number;
  matchedTags: string[];
  product: PreparedProduct;
  role: OutfitRole;
  score: number;
}

interface CoreOutfitCandidate {
  key: string;
  products: ScoredProduct[];
  scoreTotal: number;
  totalPrice: number;
}

interface BudgetCoreCandidateSelection {
  affordable: CoreOutfitCandidate[];
  closestOverBudget?: CoreOutfitCandidate;
}

interface OutfitRecommendationPayload {
  candidateCount: number;
  response: StyleAdviceResponseWithoutMode;
  resultCount: number;
}

interface StyleAdviceResponseWithoutMode {
  extraTips: string[];
  intent: StyleAdviceIntentDto;
  outfits: StyleAdviceOutfitDto[];
  query: string;
  recommendations: StyleAdviceRecommendationDto[];
  summary: string;
  warnings: string[];
}

const MAX_CANDIDATE_PRODUCTS = 200;
const MAX_OUTFITS = 2;
const MAX_CORE_ROLE_CANDIDATES = 32;
const MAX_PRIMARY_CORE_CANDIDATES = 16;
const COMPLETE_OUTFIT_ROLES: OutfitRole[] = ['top', 'bottom', 'shoes'];
const DISALLOWED_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const ROLE_TAGS: Record<OutfitRole, string[]> = {
  top: [
    'top',
    'tee',
    't_shirt',
    'tshirt',
    'shirt',
    'ao_thun',
    'ao_phong',
    'long_sleeves',
    'long_sleeve',
    'ao_tay_dai',
    'tank',
    'tank_top',
    'hoodie',
    'sweater',
  ],
  bottom: [
    'bottom',
    'bottoms',
    'pants',
    'trousers',
    'jeans',
    'denim',
    'shorts',
    'skirt',
    'quan',
    'wide_leg',
    'flared',
  ],
  shoes: [
    'shoes',
    'shoe',
    'sneakers',
    'sneaker',
    'boots',
    'boot',
    'loafers',
    'slippers',
    'giay',
  ],
  jacket: [
    'jacket',
    'outerwear',
    'coat',
    'blazer',
    'overshirt',
    'leather_jacket',
    'biker',
    'ao_khoac',
  ],
  handbag: ['handbag', 'bag', 'tote', 'shoulder_bag', 'crossbody', 'tui', 'tui_xach'],
  accessory: [
    'accessory',
    'accessories',
    'belt',
    'ring',
    'bracelet',
    'watch',
    'necklace',
    'beanie',
    'sunglasses',
    'silver_hardware',
    'phu_kien',
  ],
};

const CATEGORY_ENTRIES: CategoryDictionaryEntry[] = [
  {
    tag: 'tee',
    role: 'top',
    aliases: ['tee', 't shirt', 't-shirt', 'tshirt', 'ao thun', 'ao phong'],
    impliedTags: ['top', 'tee', 'ao_thun'],
  },
  {
    tag: 'long_sleeves',
    role: 'top',
    aliases: ['long sleeves', 'long sleeve', 'ao tay dai', 'sweater'],
    impliedTags: ['top', 'long_sleeves'],
  },
  {
    tag: 'tank_top',
    role: 'top',
    aliases: ['tank top', 'tank', 'sleeveless', 'ao ba lo', 'ao tank'],
    impliedTags: ['top', 'tank', 'tank_top', 'summer'],
  },
  {
    tag: 'jacket',
    role: 'jacket',
    aliases: ['jacket', 'outerwear', 'coat', 'blazer', 'ao khoac', 'leather jacket'],
    impliedTags: ['jacket', 'outerwear'],
  },
  {
    tag: 'bottoms',
    role: 'bottom',
    aliases: ['bottoms', 'pants', 'trousers', 'jeans', 'denim', 'shorts', 'quan'],
    impliedTags: ['bottoms', 'pants'],
  },
  {
    tag: 'shoes',
    role: 'shoes',
    aliases: ['shoes', 'sneakers', 'boots', 'boot', 'giay'],
    impliedTags: ['shoes'],
  },
  {
    tag: 'handbag',
    role: 'handbag',
    aliases: ['handbag', 'bag', 'tote', 'tui', 'tui xach'],
    impliedTags: ['handbag', 'bag'],
  },
  {
    tag: 'accessories',
    role: 'accessory',
    aliases: ['accessories', 'accessory', 'belt', 'ring', 'bracelet', 'phu kien'],
    impliedTags: ['accessories'],
  },
];

const COLOR_ENTRIES: DictionaryEntry[] = [
  { tag: 'black', aliases: ['black', 'all black', 'mau den', 'den'] },
  { tag: 'white', aliases: ['white', 'mau trang', 'trang'] },
  { tag: 'cream', aliases: ['cream', 'mau kem', 'kem'], impliedTags: ['cream', 'beige'] },
  { tag: 'beige', aliases: ['beige', 'tan'], impliedTags: ['beige', 'cream'] },
  { tag: 'brown', aliases: ['brown', 'mau nau', 'nau'] },
  { tag: 'blue', aliases: ['blue', 'mau xanh', 'xanh duong'], impliedTags: ['blue', 'denim'] },
  { tag: 'washed_blue', aliases: ['washed blue', 'light denim'], impliedTags: ['washed_blue', 'denim', 'blue'] },
  { tag: 'washed_black', aliases: ['washed black', 'faded black'], impliedTags: ['washed_black', 'black'] },
  { tag: 'silver', aliases: ['silver', 'bac'], impliedTags: ['silver', 'silver_hardware'] },
  { tag: 'gray', aliases: ['gray', 'grey', 'mau xam', 'xam'] },
];

const STYLE_ENTRIES: DictionaryEntry[] = [
  { tag: 'streetwear', aliases: ['streetwear', 'duong pho', 'street style', 'casual street'] },
  { tag: 'gothic', aliases: ['gothic', 'goth', 'cross', 'chrome hearts'], impliedTags: ['gothic', 'silver_hardware'] },
  { tag: 'darkwear', aliases: ['darkwear', 'dark wear', 'dark', 'all black'], impliedTags: ['darkwear', 'black'] },
  { tag: 'luxury_streetwear', aliases: ['luxury streetwear', 'luxury street', 'chrome hearts'], impliedTags: ['luxury_streetwear', 'silver_hardware'] },
  { tag: 'vintage', aliases: ['vintage', 'retro'] },
  { tag: 'grunge', aliases: ['grunge'] },
  { tag: 'punk', aliases: ['punk'] },
  { tag: 'minimal', aliases: ['minimal', 'minimalist', 'toi gian', 'basic'] },
  { tag: 'clean_fit', aliases: ['clean fit', 'clean', 'not too loud', 'simple'] },
  { tag: 'biker', aliases: ['biker', 'motorcycle', 'leather biker'], impliedTags: ['biker', 'leather'] },
  { tag: 'y2k', aliases: ['y2k'] },
  { tag: 'avant_garde', aliases: ['avant garde', 'avant-garde'] },
  { tag: 'casual', aliases: ['casual', 'daily', 'hang ngay'] },
  { tag: 'statement', aliases: ['statement', 'ngau', 'ca tinh'], impliedTags: ['statement', 'streetwear'] },
  { tag: 'denim', aliases: ['denim', 'jeans'], impliedTags: ['denim', 'washed_blue'] },
];

const FIT_ENTRIES: DictionaryEntry[] = [
  { tag: 'oversized', aliases: ['oversized', 'over size', 'form rong', 'rong', 'baggy'] },
  { tag: 'boxy', aliases: ['boxy'] },
  { tag: 'cropped', aliases: ['cropped', 'crop'] },
  { tag: 'regular_fit', aliases: ['regular fit', 'regular'] },
  { tag: 'wide_leg', aliases: ['wide leg', 'wide-leg', 'ong rong'] },
  { tag: 'flared', aliases: ['flared', 'loe'] },
  { tag: 'slim_fit', aliases: ['slim fit', 'slim'] },
];

const OCCASION_ENTRIES: DictionaryEntry[] = [
  { tag: 'daily_wear', aliases: ['daily wear', 'daily', 'everyday', 'hang ngay'] },
  { tag: 'going_out', aliases: ['going out', 'di choi', 'hangout', 'night out'] },
  { tag: 'date_outfit', aliases: ['date', 'date outfit', 'date night', 'hen ho'] },
  { tag: 'party', aliases: ['party', 'event', 'di tiec'] },
  { tag: 'school', aliases: ['school', 'class', 'di hoc'] },
  { tag: 'coffee', aliases: ['coffee', 'cafe', 'di cafe', 'ca phe'] },
  { tag: 'street_photo', aliases: ['street photo', 'photoshoot', 'shooting'] },
  { tag: 'travel', aliases: ['travel', 'trip', 'du lich'] },
  { tag: 'cold_weather', aliases: ['cold weather', 'cold', 'winter', 'lanh'] },
  { tag: 'summer', aliases: ['summer', 'hot weather', 'mua he'] },
  { tag: 'layering', aliases: ['layering', 'layer', 'layers'] },
];

const COMPATIBLE_TAGS: Record<string, string[]> = {
  black: ['black', 'washed_black', 'darkwear'],
  blue: ['blue', 'washed_blue', 'denim'],
  cream: ['cream', 'beige'],
  beige: ['beige', 'cream'],
  gothic: ['gothic', 'darkwear', 'silver_hardware', 'chrome_hearts'],
  darkwear: ['darkwear', 'black', 'gothic'],
  streetwear: ['streetwear', 'oversized', 'boxy'],
  luxury_streetwear: ['luxury_streetwear', 'streetwear', 'silver_hardware'],
  denim: ['denim', 'jeans', 'washed_blue'],
  shoes: ['shoes', 'sneakers', 'boots'],
};

const CLEAN_LABELS: Record<string, string> = {
  accessories: 'accessories',
  avant_garde: 'avant garde',
  biker: 'biker',
  black: 'black',
  bottoms: 'bottoms',
  casual: 'casual',
  clean_fit: 'clean fit',
  coffee: 'coffee',
  cold_weather: 'cold weather',
  cream: 'cream',
  daily_wear: 'daily wear',
  darkwear: 'darkwear',
  date_outfit: 'date outfit',
  denim: 'denim',
  flared: 'flared',
  going_out: 'going out',
  gothic: 'gothic',
  handbag: 'handbag',
  jacket: 'jacket',
  layering: 'layering',
  long_sleeves: 'long sleeves',
  luxury_streetwear: 'luxury streetwear',
  minimal: 'minimal',
  oversized: 'oversized',
  party: 'party',
  school: 'school',
  shoes: 'shoes',
  silver: 'silver',
  silver_hardware: 'silver hardware',
  street_photo: 'street photo',
  streetwear: 'streetwear',
  summer: 'summer',
  tank_top: 'tank top',
  tee: 'tee',
  travel: 'travel',
  washed_black: 'washed black',
  washed_blue: 'washed blue',
  wide_leg: 'wide leg',
  y2k: 'Y2K',
};

@Injectable()
export class OutfitRecommendationService {
  constructor(private readonly prismaService: PrismaService) {}

  async recommendOutfits(
    request: NormalizedStyleAdviceRequest,
  ): Promise<OutfitRecommendationPayload> {
    const query = this.buildPrompt(request);
    const intent = this.extractIntent(query);
    const products = await this.loadTaggedProducts();
    const preparedProducts = products.map((product) =>
      this.prepareProduct(product),
    );
    const outfits = this.composeOutfits(preparedProducts, intent, request.budget);
    const warnings = this.buildWarnings(outfits, preparedProducts, intent);
    const recommendations = this.flattenPrimaryRecommendations(outfits);
    const summary = this.buildSummary(intent, outfits.length, warnings);

    return {
      candidateCount: preparedProducts.length,
      resultCount: recommendations.length,
      response: {
        query,
        intent: {
          categories: intent.categories,
          colors: intent.colors,
          styles: intent.styles,
          occasions: intent.occasions,
          fits: intent.fits,
          negativeConstraints: [
            ...intent.negativeCategories.map((role) => `no_${role}`),
            ...intent.negativeTags,
          ],
        },
        outfits,
        recommendations,
        summary,
        warnings,
        extraTips: this.buildExtraTips(warnings, outfits.length),
      },
    };
  }

  private async loadTaggedProducts(): Promise<OutfitProductRecord[]> {
    return this.prismaService.product.findMany({
      where: {
        isActive: true,
        category: {
          isActive: true,
        },
        variants: {
          some: {
            isActive: true,
            stock: {
              gt: 0,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: MAX_CANDIDATE_PRODUCTS,
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        imageUrls: true,
        aiTags: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        productCategories: {
          where: {
            category: {
              isActive: true,
            },
          },
          select: {
            category: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        managedImages: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            imageAsset: {
              select: {
                publicUrl: true,
              },
            },
          },
        },
        variants: {
          where: {
            isActive: true,
            stock: {
              gt: 0,
            },
          },
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
          select: {
            color: true,
            priceOverride: true,
            size: true,
          },
        },
      },
    });
  }

  private extractIntent(query: string): ExtractedIntent {
    const comparablePrompt = this.normalizeComparable(query);
    const categories = new Set<string>();
    const colors = this.extractTags(comparablePrompt, COLOR_ENTRIES);
    const styles = new Set(this.extractTags(comparablePrompt, STYLE_ENTRIES));
    const occasions = this.extractTags(comparablePrompt, OCCASION_ENTRIES);
    const fits = this.extractTags(comparablePrompt, FIT_ENTRIES);
    const searchTags = new Set<string>([
      ...colors,
      ...styles,
      ...occasions,
      ...fits,
    ]);

    for (const entry of CATEGORY_ENTRIES) {
      if (!this.entryMatches(comparablePrompt, entry)) {
        continue;
      }

      categories.add(entry.tag);
      searchTags.add(entry.tag);

      for (const impliedTag of entry.impliedTags ?? []) {
        searchTags.add(impliedTag);
      }
    }

    for (const entry of [
      ...COLOR_ENTRIES,
      ...STYLE_ENTRIES,
      ...OCCASION_ENTRIES,
      ...FIT_ENTRIES,
    ]) {
      if (!this.entryMatches(comparablePrompt, entry)) {
        continue;
      }

      for (const impliedTag of entry.impliedTags ?? []) {
        searchTags.add(impliedTag);
      }
    }

    const negativeCategories = this.extractNegativeCategories(comparablePrompt);
    const negativeTags = this.extractNegativeTags(comparablePrompt);

    for (const category of [...categories]) {
      const categoryEntry = CATEGORY_ENTRIES.find((entry) => entry.tag === category);

      if (categoryEntry && negativeCategories.includes(categoryEntry.role)) {
        categories.delete(category);
      }
    }

    if (categories.size === 0 || this.looksLikeOutfitRequest(comparablePrompt)) {
      categories.add('tee');
      categories.add('bottoms');
      categories.add('shoes');
      searchTags.add('tee');
      searchTags.add('bottoms');
      searchTags.add('shoes');
    }

    if (negativeTags.includes('too_loud')) {
      styles.add('clean_fit');
      styles.add('minimal');
      searchTags.add('clean_fit');
      searchTags.add('minimal');
    }

    return {
      categories: [...categories],
      colors,
      styles: [...styles],
      occasions,
      fits,
      negativeCategories,
      negativeTags,
      searchTags: [...searchTags],
    };
  }

  private composeOutfits(
    products: PreparedProduct[],
    intent: ExtractedIntent,
    budgetMax?: number,
  ): StyleAdviceOutfitDto[] {
    const scoredByRole = new Map<OutfitRole, ScoredProduct[]>();

    for (const role of COMPLETE_OUTFIT_ROLES) {
      scoredByRole.set(role, this.scoreProductsForRole(products, role, intent));
    }

    if (this.shouldIncludeJacket(intent)) {
      scoredByRole.set('jacket', this.scoreProductsForRole(products, 'jacket', intent));
    }

    if (this.shouldIncludeAccessories(intent)) {
      scoredByRole.set('accessory', this.scoreProductsForRole(products, 'accessory', intent));
      scoredByRole.set('handbag', this.scoreProductsForRole(products, 'handbag', intent));
    }

    const budgetCandidates =
      budgetMax === undefined
        ? undefined
        : this.findBudgetCoreCandidates(scoredByRole, budgetMax);
    const coreCandidates =
      budgetMax === undefined
        ? this.buildCoreOutfitCandidates(scoredByRole)
        : budgetCandidates?.affordable ?? [];
    const selectedCandidates =
      budgetMax === undefined
        ? coreCandidates.slice(0, MAX_OUTFITS)
        : coreCandidates.length > 0
          ? coreCandidates
          : budgetCandidates?.closestOverBudget
            ? [budgetCandidates.closestOverBudget]
            : [];

    if (selectedCandidates.length === 0) {
      return this.composeIncompleteOutfit(scoredByRole, intent, budgetMax);
    }

    const needsBudgetWarning = budgetMax !== undefined && coreCandidates.length === 0;

    return selectedCandidates.map((candidate, index) =>
      this.buildOutfitFromCoreCandidate(
        candidate,
        scoredByRole,
        intent,
        index + 1,
        budgetMax,
        needsBudgetWarning,
      ),
    );
  }

  private buildCoreOutfitCandidates(
    scoredByRole: Map<OutfitRole, ScoredProduct[]>,
  ): CoreOutfitCandidate[] {
    const [tops, bottoms, shoes] = COMPLETE_OUTFIT_ROLES.map((role) =>
      this.limitCoreRoleCandidates(scoredByRole.get(role) ?? []),
    );

    if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) {
      return [];
    }

    const candidates: CoreOutfitCandidate[] = [];

    for (const top of tops) {
      for (const bottom of bottoms) {
        if (top.product.record.id === bottom.product.record.id) {
          continue;
        }

        for (const shoe of shoes) {
          const products = [top, bottom, shoe];
          const productIds = products.map((product) => product.product.record.id);

          if (new Set(productIds).size !== products.length) {
            continue;
          }

          candidates.push({
            key: [...productIds].sort().join(':'),
            products,
            scoreTotal: products.reduce((total, product) => total + product.score, 0),
            totalPrice: products.reduce(
              (total, product) => total + product.product.price,
              0,
            ),
          });
        }
      }
    }

    return candidates.sort((left, right) => this.compareCoreCandidates(left, right));
  }

  private limitCoreRoleCandidates(
    candidates: ScoredProduct[],
  ): ScoredProduct[] {
    if (candidates.length <= MAX_CORE_ROLE_CANDIDATES) {
      return candidates;
    }

    const selectedByProductId = new Map<string, ScoredProduct>();
    const cheapestCandidates = [...candidates]
      .sort(
        (left, right) =>
          left.product.price - right.product.price ||
          right.score - left.score ||
          left.product.record.name.localeCompare(right.product.record.name),
      )
      .slice(0, MAX_CORE_ROLE_CANDIDATES - MAX_PRIMARY_CORE_CANDIDATES);

    for (const candidate of [
      ...candidates.slice(0, MAX_PRIMARY_CORE_CANDIDATES),
      ...cheapestCandidates,
    ]) {
      selectedByProductId.set(candidate.product.record.id, candidate);
    }

    return [...selectedByProductId.values()]
      .sort((left, right) => this.compareScoredProducts(left, right))
      .slice(0, MAX_CORE_ROLE_CANDIDATES);
  }

  private findBudgetCoreCandidates(
    scoredByRole: Map<OutfitRole, ScoredProduct[]>,
    budgetMax: number,
  ): BudgetCoreCandidateSelection {
    const [tops, bottoms, shoes] = COMPLETE_OUTFIT_ROLES.map(
      (role) => scoredByRole.get(role) ?? [],
    );
    const affordable: CoreOutfitCandidate[] = [];

    for (const top of tops) {
      for (const bottom of bottoms) {
        if (top.product.record.id === bottom.product.record.id) {
          continue;
        }

        const remainingBudget = budgetMax - top.product.price - bottom.product.price;
        if (remainingBudget < 0) {
          continue;
        }

        let retainedShoes = 0;
        for (const shoe of shoes) {
          if (
            shoe.product.record.id === top.product.record.id ||
            shoe.product.record.id === bottom.product.record.id ||
            shoe.product.price > remainingBudget
          ) {
            continue;
          }

          this.retainBestCoreCandidate(
            affordable,
            this.createCoreOutfitCandidate([top, bottom, shoe]),
          );
          retainedShoes += 1;

          if (retainedShoes === MAX_OUTFITS) {
            break;
          }
        }
      }
    }

    if (affordable.length > 0) {
      return { affordable };
    }

    const closestOverBudget = this.findLowestPricedCoreCandidate(tops, bottoms, shoes);

    return { affordable, ...(closestOverBudget ? { closestOverBudget } : {}) };
  }

  private findLowestPricedCoreCandidate(
    tops: ScoredProduct[],
    bottoms: ScoredProduct[],
    shoes: ScoredProduct[],
  ): CoreOutfitCandidate | undefined {
    const shoesByPrice = [...shoes].sort(
      (left, right) =>
        left.product.price - right.product.price ||
        this.compareScoredProducts(left, right),
    );
    let closest: CoreOutfitCandidate | undefined;

    for (const top of tops) {
      for (const bottom of bottoms) {
        if (top.product.record.id === bottom.product.record.id) {
          continue;
        }

        const shoe = shoesByPrice.find(
          (candidate) =>
            candidate.product.record.id !== top.product.record.id &&
            candidate.product.record.id !== bottom.product.record.id,
        );

        if (!shoe) {
          continue;
        }

        const candidate = this.createCoreOutfitCandidate([top, bottom, shoe]);

        if (
          !closest ||
          candidate.totalPrice < closest.totalPrice ||
          (candidate.totalPrice === closest.totalPrice &&
            this.compareCoreCandidates(candidate, closest) < 0)
        ) {
          closest = candidate;
        }
      }
    }

    return closest;
  }

  private retainBestCoreCandidate(
    candidates: CoreOutfitCandidate[],
    candidate: CoreOutfitCandidate,
  ) {
    if (
      candidates.length === MAX_OUTFITS &&
      this.compareCoreCandidates(candidate, candidates[MAX_OUTFITS - 1]) >= 0
    ) {
      return;
    }

    candidates.push(candidate);
    candidates.sort((left, right) => this.compareCoreCandidates(left, right));
    candidates.splice(MAX_OUTFITS);
  }

  private createCoreOutfitCandidate(
    products: [ScoredProduct, ScoredProduct, ScoredProduct],
  ): CoreOutfitCandidate {
    const productIds = products.map((product) => product.product.record.id);

    return {
      key: [...productIds].sort().join(':'),
      products,
      scoreTotal: products.reduce((total, product) => total + product.score, 0),
      totalPrice: products.reduce(
        (total, product) => total + product.product.price,
        0,
      ),
    };
  }

  private buildOutfitFromCoreCandidate(
    candidate: CoreOutfitCandidate,
    scoredByRole: Map<OutfitRole, ScoredProduct[]>,
    intent: ExtractedIntent,
    optionNumber: number,
    budgetMax: number | undefined,
    needsBudgetWarning: boolean,
  ): StyleAdviceOutfitDto {
    const selectedIds = new Set(
      candidate.products.map((product) => product.product.record.id),
    );
    const selectedRoles = new Set(candidate.products.map((product) => product.role));
    const selectedProducts = [...candidate.products];
    const outfitWarnings = candidate.products
      .filter((product) => this.isWeakMatch(product, intent))
      .map(
        (product) =>
          `No strong ${this.cleanLabel(product.role)} match was found, so this uses the closest in-stock option.`,
      );
    let totalPrice = candidate.totalPrice;

    const jacket = this.pickForRole(
      scoredByRole.get('jacket') ?? [],
      optionNumber - 1,
      selectedIds,
    );
    totalPrice = this.addOptionalProduct(
      jacket,
      intent,
      budgetMax,
      selectedIds,
      selectedRoles,
      selectedProducts,
      totalPrice,
    );

    const accessoryOrBag = this.pickForRole(
      [...(scoredByRole.get('accessory') ?? []), ...(scoredByRole.get('handbag') ?? [])].sort(
        (left, right) => this.compareScoredProducts(left, right),
      ),
      optionNumber - 1,
      selectedIds,
    );
    totalPrice = this.addOptionalProduct(
      accessoryOrBag,
      intent,
      budgetMax,
      selectedIds,
      selectedRoles,
      selectedProducts,
      totalPrice,
    );

    if (needsBudgetWarning && budgetMax !== undefined) {
      outfitWarnings.unshift(this.buildBudgetWarning(budgetMax));
    }

    const uniqueProducts = this.keepHighestScoringProductPerRole(selectedProducts);
    const outfitProducts = uniqueProducts.map((product) => this.mapOutfitProduct(product));
    const scoreTotal = uniqueProducts.reduce((total, product) => total + product.score, 0);

    return {
      title: this.buildOutfitTitle(intent, optionNumber),
      reason: this.buildOutfitReason(intent, outfitProducts, outfitWarnings),
      score: Math.min(
        100,
        Math.max(0, Math.round(scoreTotal / uniqueProducts.length)),
      ),
      matchedIntentTags: this.cleanTags(
        this.getMatchedIntentTags(outfitProducts, intent),
      ),
      products: outfitProducts,
      warnings: [...new Set(outfitWarnings)],
    };
  }

  private composeIncompleteOutfit(
    scoredByRole: Map<OutfitRole, ScoredProduct[]>,
    intent: ExtractedIntent,
    budgetMax?: number,
  ): StyleAdviceOutfitDto[] {
    const selectedIds = new Set<string>();
    const selectedProducts: ScoredProduct[] = [];
    const outfitWarnings: string[] = [];
    let totalPrice = 0;

    for (const role of COMPLETE_OUTFIT_ROLES) {
      const scoredProduct = this.pickForRole(
        scoredByRole.get(role) ?? [],
        0,
        selectedIds,
      );

      if (!scoredProduct) {
        outfitWarnings.push(
          `No in-stock ${this.cleanLabel(role)} was available from tagged products.`,
        );
        continue;
      }

      if (
        budgetMax !== undefined &&
        totalPrice + scoredProduct.product.price > budgetMax
      ) {
        continue;
      }

      selectedIds.add(scoredProduct.product.record.id);
      selectedProducts.push(scoredProduct);
      totalPrice += scoredProduct.product.price;

      if (this.isWeakMatch(scoredProduct, intent)) {
        outfitWarnings.push(
          `No strong ${this.cleanLabel(role)} match was found, so this uses the closest in-stock option.`,
        );
      }
    }

    if (selectedProducts.length === 0) {
      return [];
    }

    if (budgetMax !== undefined) {
      outfitWarnings.unshift(this.buildBudgetWarning(budgetMax));
    }

    const uniqueProducts = this.keepHighestScoringProductPerRole(selectedProducts);
    const outfitProducts = uniqueProducts.map((product) => this.mapOutfitProduct(product));
    const scoreTotal = uniqueProducts.reduce((total, product) => total + product.score, 0);

    return [
      {
        title: this.buildOutfitTitle(intent, 1),
        reason: this.buildOutfitReason(intent, outfitProducts, outfitWarnings),
        score: Math.min(
          100,
          Math.max(0, Math.round(scoreTotal / uniqueProducts.length)),
        ),
        matchedIntentTags: this.cleanTags(
          this.getMatchedIntentTags(outfitProducts, intent),
        ),
        products: outfitProducts,
        warnings: [...new Set(outfitWarnings)],
      },
    ];
  }

  private addOptionalProduct(
    scoredProduct: ScoredProduct | undefined,
    intent: ExtractedIntent,
    budgetMax: number | undefined,
    selectedIds: Set<string>,
    selectedRoles: Set<OutfitRole>,
    selectedProducts: ScoredProduct[],
    totalPrice: number,
  ): number {
    if (
      !scoredProduct ||
      this.isWeakOptionalMatch(scoredProduct, intent) ||
      selectedIds.has(scoredProduct.product.record.id) ||
      selectedRoles.has(scoredProduct.role) ||
      (budgetMax !== undefined &&
        totalPrice + scoredProduct.product.price > budgetMax)
    ) {
      return totalPrice;
    }

    selectedIds.add(scoredProduct.product.record.id);
    selectedRoles.add(scoredProduct.role);
    selectedProducts.push(scoredProduct);

    return totalPrice + scoredProduct.product.price;
  }

  private keepHighestScoringProductPerRole(
    products: ScoredProduct[],
  ): ScoredProduct[] {
    const bestByRole = new Map<OutfitRole, ScoredProduct>();

    for (const product of products) {
      const existing = bestByRole.get(product.role);

      if (!existing || this.compareScoredProducts(product, existing) < 0) {
        bestByRole.set(product.role, product);
      }
    }

    return products.filter(
      (product) => bestByRole.get(product.role) === product,
    );
  }

  private compareCoreCandidates(
    left: CoreOutfitCandidate,
    right: CoreOutfitCandidate,
  ): number {
    return (
      right.scoreTotal - left.scoreTotal ||
      left.totalPrice - right.totalPrice ||
      left.key.localeCompare(right.key)
    );
  }

  private compareScoredProducts(
    left: ScoredProduct,
    right: ScoredProduct,
  ): number {
    return (
      right.score - left.score ||
      left.product.price - right.product.price ||
      left.product.record.name.localeCompare(right.product.record.name)
    );
  }

  private buildBudgetWarning(budgetMax: number): string {
    return `No complete outfit under ${budgetMax} VND was found. Showing the closest available outfit.`;
  }

  private scoreProductsForRole(
    products: PreparedProduct[],
    role: OutfitRole,
    intent: ExtractedIntent,
  ): ScoredProduct[] {
    if (intent.negativeCategories.includes(role)) {
      return [];
    }

    return products
      .filter((product) => product.roles.has(role))
      .map((product, index) => this.scoreProduct(product, role, intent, index))
      .filter((product) => product.score > Number.NEGATIVE_INFINITY)
      .sort((left, right) => this.compareScoredProducts(left, right));
  }

  private scoreProduct(
    product: PreparedProduct,
    role: OutfitRole,
    intent: ExtractedIntent,
    index: number,
  ): ScoredProduct {
    const matchedTags = new Set<string>();
    let score = 10;
    let intentScore = 0;

    for (const negativeTag of intent.negativeTags) {
      if (this.hasCompatibleTag(product.tagSet, negativeTag)) {
        score -= 45;
      }
    }

    if (this.roleHasExactTag(product, role)) {
      score += 30;
      matchedTags.add(this.roleToCategoryTag(role));
    } else if (product.roles.has(role)) {
      score += 18;
    }

    for (const category of intent.categories) {
      if (this.categoryAppliesToRole(category, role)) {
        score += 30;
        intentScore += 30;
        matchedTags.add(category);
      } else if (this.hasCompatibleTag(product.tagSet, category)) {
        score += 16;
        intentScore += 16;
        matchedTags.add(category);
      }
    }

    for (const color of intent.colors) {
      if (this.hasCompatibleTag(product.tagSet, color)) {
        score += 20;
        intentScore += 20;
        matchedTags.add(color);
      } else if (this.hasCompatibleTag(product.variantColorTags, color)) {
        score += 8;
        intentScore += 8;
        matchedTags.add(color);
      }
    }

    for (const style of intent.styles) {
      if (this.hasCompatibleTag(product.tagSet, style)) {
        score += 20;
        intentScore += 20;
        matchedTags.add(style);
      }
    }

    for (const occasion of intent.occasions) {
      if (this.hasCompatibleTag(product.tagSet, occasion)) {
        score += 10;
        intentScore += 10;
        matchedTags.add(occasion);
      }
    }

    for (const fit of intent.fits) {
      if (this.hasCompatibleTag(product.tagSet, fit)) {
        score += 10;
        intentScore += 10;
        matchedTags.add(fit);
      }
    }

    if (!product.imageUrl) {
      score -= 10;
    }

    return {
      intentScore,
      matchedTags: this.cleanTags([...matchedTags]),
      product,
      role,
      score: score - index * 0.01,
    };
  }

  private prepareProduct(product: OutfitProductRecord): PreparedProduct {
    const tagSet = new Set(product.aiTags.map((tag) => this.normalizeTag(tag)));
    const categoryTags = new Set(
      [product.category, ...product.productCategories.map((entry) => entry.category)]
        .flatMap((category) => [category.name, category.slug])
        .map((value) => this.normalizeTag(value)),
    );
    const variantColorTags = new Set(
      product.variants.map((variant) => this.normalizeTag(variant.color)),
    );
    const roles = this.detectRoles(tagSet, categoryTags);
    const prices = product.variants.map(
      (variant) => variant.priceOverride ?? product.basePrice,
    );

    return {
      categoryTags,
      imageUrl:
        product.managedImages[0]?.imageAsset.publicUrl ?? product.imageUrls[0],
      price: prices.length > 0 ? Math.min(...prices) : product.basePrice,
      record: product,
      roles,
      tagSet,
      variantColorTags,
    };
  }

  private detectRoles(
    tagSet: Set<string>,
    categoryTags: Set<string>,
  ): Set<OutfitRole> {
    const haystack = new Set([...tagSet, ...categoryTags]);
    const roles = new Set<OutfitRole>();

    for (const [role, roleTags] of Object.entries(ROLE_TAGS) as Array<
      [OutfitRole, string[]]
    >) {
      if (roleTags.some((tag) => haystack.has(tag))) {
        roles.add(role);
      }
    }

    return roles;
  }

  private pickForRole(
    candidates: ScoredProduct[],
    preferredIndex: number,
    selectedIds: Set<string>,
  ): ScoredProduct | undefined {
    return (
      candidates.filter((candidate) => !selectedIds.has(candidate.product.record.id))[
        preferredIndex
      ] ?? candidates.find((candidate) => !selectedIds.has(candidate.product.record.id))
    );
  }

  private mapOutfitProduct(scoredProduct: ScoredProduct): StyleAdviceOutfitProductDto {
    const product = scoredProduct.product.record;

    return {
      role: scoredProduct.role,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      ...(scoredProduct.product.imageUrl
        ? { imageUrl: scoredProduct.product.imageUrl }
        : {}),
      price: scoredProduct.product.price,
      matchedTags: scoredProduct.matchedTags,
    };
  }

  private flattenPrimaryRecommendations(
    outfits: StyleAdviceOutfitDto[],
  ): StyleAdviceRecommendationDto[] {
    const firstOutfit = outfits[0];

    if (!firstOutfit) {
      return [];
    }

    return firstOutfit.products.map((product) => ({
      productId: product.productId,
      productSlug: product.productSlug,
      productName: product.productName,
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      price: product.price,
      reason: `${this.cleanLabel(product.role)} selected for this outfit.`,
    }));
  }

  private buildWarnings(
    outfits: StyleAdviceOutfitDto[],
    products: PreparedProduct[],
    intent: ExtractedIntent,
  ): string[] {
    const warnings = new Set<string>();

    if (products.length === 0) {
      warnings.add('No active in-stock products were available for outfit matching.');
    }

    if (products.every((product) => product.tagSet.size === 0)) {
      warnings.add('No active in-stock products currently have Internal AI Tags.');
    }

    for (const role of COMPLETE_OUTFIT_ROLES) {
      if (intent.negativeCategories.includes(role)) {
        continue;
      }

      if (!products.some((product) => product.roles.has(role))) {
        warnings.add(`No active in-stock ${this.cleanLabel(role)} products are tagged for outfit matching.`);
      }
    }

    for (const outfit of outfits) {
      for (const warning of outfit.warnings) {
        warnings.add(warning);
      }
    }

    return [...warnings].slice(0, 6);
  }

  private buildSummary(
    intent: ExtractedIntent,
    outfitCount: number,
    warnings: string[],
  ): string {
    const intentLabels = this.cleanTags([
      ...intent.colors,
      ...intent.styles,
      ...intent.occasions,
      ...intent.fits,
    ]).slice(0, 4);

    if (outfitCount === 0) {
      return 'I could not build an outfit from active in-stock tagged products for that prompt.';
    }

    const base =
      intentLabels.length > 0
        ? `I matched ${intentLabels.map((tag) => this.cleanLabel(tag)).join(', ')} against Belikeme tagged products and built ${outfitCount} outfit option${outfitCount === 1 ? '' : 's'}.`
        : `I matched your prompt against Belikeme tagged products and built ${outfitCount} outfit option${outfitCount === 1 ? '' : 's'}.`;

    return warnings.length > 0
      ? `${base} Some categories needed relaxed matching.`
      : base;
  }

  private buildExtraTips(warnings: string[], outfitCount: number): string[] {
    if (outfitCount === 0) {
      return [
        'Try adding a color, style, occasion, or core item such as tee, jeans, boots, or accessories.',
      ];
    }

    return [
      'Open each product to confirm the current color, size, and price before adding it to cart.',
      ...warnings.slice(0, 2),
    ];
  }

  private buildOutfitTitle(intent: ExtractedIntent, optionNumber: number): string {
    const labels = this.cleanTags([
      ...intent.colors.slice(0, 1),
      ...intent.styles.slice(0, 2),
      ...intent.occasions.slice(0, 1),
    ]);
    const titleBase =
      labels.length > 0
        ? labels.map((tag) => this.toTitleCase(this.cleanLabel(tag))).join(' ')
        : 'Belikeme Tagged';

    return `${titleBase} Fit ${optionNumber}`;
  }

  private buildOutfitReason(
    intent: ExtractedIntent,
    products: StyleAdviceOutfitProductDto[],
    warnings: string[],
  ): string {
    const matches = this.cleanTags(this.getMatchedIntentTags(products, intent));

    if (matches.length === 0) {
      return warnings.length > 0
        ? 'Built from the closest active in-stock tagged products available.'
        : 'Built from active in-stock Belikeme products that fit the requested outfit structure.';
    }

    return `Built around ${matches.map((tag) => this.cleanLabel(tag)).join(', ')} matches from active in-stock Belikeme products.`;
  }

  private getMatchedIntentTags(
    products: StyleAdviceOutfitProductDto[],
    intent: ExtractedIntent,
  ): string[] {
    const allowed = new Set([
      ...intent.searchTags,
      ...intent.categories,
      ...intent.colors,
      ...intent.styles,
      ...intent.occasions,
      ...intent.fits,
    ]);

    return products.flatMap((product) =>
      product.matchedTags.filter((tag) => allowed.has(tag)),
    );
  }

  private shouldIncludeJacket(intent: ExtractedIntent): boolean {
    if (intent.negativeCategories.includes('jacket')) {
      return false;
    }

    return [
      ...intent.categories,
      ...intent.styles,
      ...intent.occasions,
    ].some((tag) =>
      ['jacket', 'cold_weather', 'layering', 'biker', 'gothic', 'darkwear'].includes(tag),
    );
  }

  private shouldIncludeAccessories(intent: ExtractedIntent): boolean {
    if (
      intent.negativeCategories.includes('accessory') &&
      intent.negativeCategories.includes('handbag')
    ) {
      return false;
    }

    return [
      ...intent.categories,
      ...intent.styles,
      ...intent.colors,
    ].some((tag) =>
      ['accessories', 'handbag', 'gothic', 'darkwear', 'luxury_streetwear', 'silver'].includes(tag),
    );
  }

  private isWeakMatch(scoredProduct: ScoredProduct, intent: ExtractedIntent): boolean {
    return this.hasSpecificIntent(intent) && scoredProduct.intentScore < 20;
  }

  private isWeakOptionalMatch(
    scoredProduct: ScoredProduct,
    intent: ExtractedIntent,
  ): boolean {
    return this.hasSpecificIntent(intent) && scoredProduct.intentScore < 20;
  }

  private hasSpecificIntent(intent: ExtractedIntent): boolean {
    return (
      intent.colors.length > 0 ||
      intent.styles.length > 0 ||
      intent.occasions.length > 0 ||
      intent.fits.length > 0
    );
  }

  private extractTags(
    comparablePrompt: string,
    entries: DictionaryEntry[],
  ): string[] {
    const tags = new Set<string>();

    for (const entry of entries) {
      if (this.entryMatches(comparablePrompt, entry)) {
        tags.add(entry.tag);
      }
    }

    return [...tags];
  }

  private entryMatches(comparablePrompt: string, entry: DictionaryEntry): boolean {
    return entry.aliases.some((alias) =>
      this.hasEntryAlias(comparablePrompt, entry.tag, this.normalizeComparable(alias)),
    );
  }

  private hasEntryAlias(
    comparablePrompt: string,
    tag: string,
    comparableAlias: string,
  ): boolean {
    if (tag !== 'handbag' || comparableAlias !== 'tui') {
      return this.hasAlias(comparablePrompt, comparableAlias);
    }

    if (/\btui\s+(?:muon|can|thich|dang|nen|se|co)\b/.test(comparablePrompt)) {
      return false;
    }

    return (
      /\b(?:voi|va|them|mot|cai)\s+tui\b/.test(comparablePrompt) ||
      /\btui\s+(?:xach|deo|mini|den|trang|kem|beige|bac)\b/.test(comparablePrompt)
    );
  }

  private extractNegativeCategories(comparablePrompt: string): OutfitRole[] {
    const negatives = new Set<OutfitRole>();

    if (/\b(?:no|without|skip)\s+(?:jacket|coat|outerwear|ao khoac)\b/.test(comparablePrompt)) {
      negatives.add('jacket');
    }

    if (/\b(?:no|without|skip)\s+(?:accessories|accessory|belt|ring|bracelet|phu kien)\b/.test(comparablePrompt)) {
      negatives.add('accessory');
    }

    if (/\b(?:no|without|skip)\s+(?:bag|handbag|tote|tui)\b/.test(comparablePrompt)) {
      negatives.add('handbag');
    }

    return [...negatives];
  }

  private extractNegativeTags(comparablePrompt: string): string[] {
    const negatives = new Set<string>();

    if (/\b(?:not too dark|not dark|khong qua toi|khong qua den)\b/.test(comparablePrompt)) {
      negatives.add('darkwear');
      negatives.add('gothic');
    }

    if (/\b(?:not too loud|not loud|simple|khong qua loe loet)\b/.test(comparablePrompt)) {
      negatives.add('statement');
      negatives.add('punk');
      negatives.add('avant_garde');
      negatives.add('too_loud');
    }

    return [...negatives];
  }

  private looksLikeOutfitRequest(comparablePrompt: string): boolean {
    return /\b(?:outfit|fit|full look|complete look|set do|phoi do|trang phuc|mac gi)\b/.test(
      comparablePrompt,
    );
  }

  private roleHasExactTag(product: PreparedProduct, role: OutfitRole): boolean {
    return ROLE_TAGS[role].some((tag) => product.tagSet.has(tag));
  }

  private roleToCategoryTag(role: OutfitRole): string {
    if (role === 'top') {
      return 'tee';
    }

    if (role === 'bottom') {
      return 'bottoms';
    }

    if (role === 'accessory') {
      return 'accessories';
    }

    return role;
  }

  private categoryAppliesToRole(category: string, role: OutfitRole): boolean {
    return CATEGORY_ENTRIES.some(
      (entry) => entry.tag === category && entry.role === role,
    );
  }

  private hasCompatibleTag(tagSet: Set<string>, tag: string): boolean {
    const normalizedTag = this.normalizeTag(tag);

    if (tagSet.has(normalizedTag)) {
      return true;
    }

    return (COMPATIBLE_TAGS[normalizedTag] ?? []).some((compatibleTag) =>
      tagSet.has(this.normalizeTag(compatibleTag)),
    );
  }

  private hasAlias(comparablePrompt: string, comparableAlias: string): boolean {
    if (!comparableAlias) {
      return false;
    }

    const escapedAlias = comparableAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^| )${escapedAlias}(?: |$)`).test(comparablePrompt);
  }

  private buildPrompt(request: NormalizedStyleAdviceRequest): string {
    return [
      request.occasion,
      request.style,
      request.bodyType,
      request.notes,
      ...request.preferredColors,
      ...request.preferredSizes,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
  }

  private normalizeComparable(value: string): string {
    return value
      .replace(DISALLOWED_CONTROL_CHARACTERS, ' ')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/gi, 'd')
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTag(value: string): string {
    return this.normalizeComparable(value).replace(/\s+/g, '_');
  }

  private cleanTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const tag of tags) {
      const normalizedTag = this.normalizeTag(tag);

      if (!normalizedTag || seen.has(normalizedTag)) {
        continue;
      }

      seen.add(normalizedTag);
      result.push(normalizedTag);
    }

    return result;
  }

  private cleanLabel(tag: string): string {
    const normalizedTag = this.normalizeTag(tag);
    return CLEAN_LABELS[normalizedTag] ?? normalizedTag.replace(/_/g, ' ');
  }

  private toTitleCase(value: string): string {
    return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }
}
