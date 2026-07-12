import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NormalizedStyleAdviceRequest,
  StyleAdviceIntentDto,
  StyleAdviceOutfitDto,
  StyleAdviceOutfitProductDto,
  StyleAdviceOutfitProductRole,
  StyleAdviceCurrentOutfitDto,
  StyleAdviceRefinementAction,
  StyleAdviceRefinementDto,
} from './dto/style-advice.dto';
import type { StyleAdviceLocale } from './style-advice-locale';

type OutfitRole = StyleAdviceOutfitProductRole;

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
  summary: string;
  warnings: string[];
  refinement?: StyleAdviceRefinementDto;
}

interface ParsedRefinement {
  action: StyleAdviceRefinementAction;
  cheaper: boolean;
  legacyOptionReference: boolean;
  hasRefinementIntent: boolean;
  keepRoles: OutfitRole[];
  removeRoles: OutfitRole[];
  replaceRoles: OutfitRole[];
  replacementRoleBySource: Map<OutfitRole, OutfitRole>;
  replacementTags: Map<OutfitRole, string[]>;
  requiresPreviousContext: boolean;
  targetRoles: OutfitRole[];
}

interface RefinedOutfitResult {
  outfit?: StyleAdviceOutfitDto;
  refinement: StyleAdviceRefinementDto;
  warnings: string[];
}

const MAX_CANDIDATE_PRODUCTS = 200;
const MAX_OUTFITS = 2;
const MAX_CORE_ROLE_CANDIDATES = 32;
const MAX_PRIMARY_CORE_CANDIDATES = 16;
const CORE_OUTFIT_ROLES: OutfitRole[] = ['top', 'bottom'];
const OUTFIT_ROLE_ORDER: OutfitRole[] = [
  'top',
  'bottom',
  'shoes',
  'jacket',
  'handbag',
  'accessory',
];
const PREFERRED_TOP_TAGS = [
  'tee',
  't_shirt',
  'tshirt',
  'ao_thun',
  'ao_phong',
  'long_sleeves',
  'long_sleeve',
  'ao_tay_dai',
];
const PREFERRED_TOP_ALIASES = [
  'tee',
  't shirt',
  'tshirt',
  'ao thun',
  'ao phong',
  'long sleeves',
  'long sleeve',
  'ao tay dai',
];
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
    tag: 'top',
    role: 'top',
    aliases: ['top', 'ao', 'ao tren'],
    impliedTags: ['top'],
  },
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
    aliases: [
      'bottom',
      'bottoms',
      'pants',
      'trousers',
      'jeans',
      'quan jeans',
      'denim',
      'shorts',
      'quan',
    ],
    impliedTags: ['bottoms', 'pants'],
  },
  {
    tag: 'shoes',
    role: 'shoes',
    aliases: ['shoes', 'sneakers', 'boots', 'boot', 'giay', 'doi giay'],
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
    aliases: [
      'accessories',
      'accessory',
      'belt',
      'ring',
      'bracelet',
      'phu kien',
      'trang suc',
      'vong',
      'nhan',
    ],
    impliedTags: ['accessories'],
  },
];

const COLOR_ENTRIES: DictionaryEntry[] = [
  { tag: 'black', aliases: ['black', 'all black', 'mau den', 'den'] },
  { tag: 'white', aliases: ['white', 'mau trang', 'trang'] },
  { tag: 'cream', aliases: ['cream', 'mau kem', 'kem'], impliedTags: ['cream', 'beige'] },
  { tag: 'beige', aliases: ['beige', 'tan'], impliedTags: ['beige', 'cream'] },
  { tag: 'brown', aliases: ['brown', 'mau nau', 'nau'] },
  {
    tag: 'blue',
    aliases: ['blue', 'xanh', 'xanh duong', 'xanh blue', 'mau xanh'],
    impliedTags: ['blue', 'denim'],
  },
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
  {
    tag: 'minimal',
    aliases: ['minimal', 'minimalist', 'toi gian', 'don gian', 'basic'],
  },
  {
    tag: 'clean_fit',
    aliases: [
      'clean fit',
      'clean',
      'simple',
      'de mac',
      'not too loud',
      'not too flashy',
      'not flashy',
      'khong qua noi',
      'khong loe loet',
      'khong qua lo',
    ],
  },
  { tag: 'biker', aliases: ['biker', 'motorcycle', 'leather biker'], impliedTags: ['biker', 'leather'] },
  { tag: 'y2k', aliases: ['y2k'] },
  { tag: 'avant_garde', aliases: ['avant garde', 'avant-garde'] },
  {
    tag: 'casual',
    aliases: ['casual', 'daily', 'hang ngay', 'thuong ngay', 'de mac'],
  },
  {
    tag: 'rick_owens_style',
    aliases: ['rick owens style', 'rick owens vibe', 'rick owens'],
    impliedTags: ['darkwear', 'avant_garde'],
  },
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
  {
    tag: 'daily_wear',
    aliases: [
      'daily wear',
      'daily',
      'everyday',
      'hang ngay',
      'thuong ngay',
    ],
  },
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
  rick_owens_style: ['rick_owens_style', 'darkwear', 'avant_garde', 'gothic'],
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
  rick_owens_style: 'Rick Owens-inspired',
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

const VIETNAMESE_LABELS: Record<string, string> = {
  accessories: 'phụ kiện',
  accessory: 'phụ kiện',
  avant_garde: 'avant-garde',
  beige: 'màu be',
  biker: 'phong cách biker',
  black: 'màu đen',
  bottom: 'quần',
  bottoms: 'quần',
  casual: 'phong cách thường ngày',
  clean_fit: 'phong cách gọn gàng',
  coffee: 'đi cafe',
  cold_weather: 'thời tiết lạnh',
  cream: 'màu kem',
  daily_wear: 'mặc hằng ngày',
  darkwear: 'phong cách darkwear',
  date_outfit: 'đi hẹn hò',
  denim: 'denim',
  flared: 'ống loe',
  going_out: 'đi chơi',
  gothic: 'phong cách gothic',
  handbag: 'túi',
  jacket: 'áo khoác',
  layering: 'phối nhiều lớp',
  long_sleeves: 'áo tay dài',
  luxury_streetwear: 'streetwear cao cấp',
  minimal: 'phong cách tối giản',
  rick_owens_style: 'phong cách lấy cảm hứng từ Rick Owens',
  oversized: 'form rộng',
  party: 'đi tiệc',
  school: 'đi học',
  shoes: 'giày',
  silver: 'màu bạc',
  silver_hardware: 'chi tiết kim loại bạc',
  street_photo: 'chụp ảnh đường phố',
  streetwear: 'phong cách streetwear',
  summer: 'mùa hè',
  tank_top: 'áo ba lỗ',
  tee: 'áo thun',
  top: 'áo',
  travel: 'đi du lịch',
  washed_black: 'đen wash',
  washed_blue: 'xanh wash',
  wide_leg: 'ống rộng',
  y2k: 'phong cách Y2K',
};

@Injectable()
export class OutfitRecommendationService {
  constructor(private readonly prismaService: PrismaService) {}

  async recommendOutfits(
    request: NormalizedStyleAdviceRequest,
    locale: StyleAdviceLocale = 'en',
  ): Promise<OutfitRecommendationPayload> {
    const query = this.buildPrompt(request);
    const currentIntent = this.extractIntent(query);
    const parsedRefinement = this.parseRefinement(query, request.budget);
    const products = await this.loadTaggedProducts();
    const preparedProducts = products.map((product) =>
      this.prepareProduct(product),
    );

    if (
      parsedRefinement.requiresPreviousContext &&
      !request.currentOutfit
    ) {
      return this.buildMissingContextPayload(
        query,
        currentIntent,
        preparedProducts.length,
        parsedRefinement,
        locale,
      );
    }

    if (
      parsedRefinement.hasRefinementIntent &&
      request.currentOutfit
    ) {
      const intent = this.mergeCurrentIntent(
        currentIntent,
        request.currentOutfit.intent,
      );
      const refined = this.refineCurrentOutfit(
        preparedProducts,
        intent,
        currentIntent,
        parsedRefinement,
        request.currentOutfit,
        request.budget,
        request.currentOutfit.budget,
        locale,
      );
      const outfits = refined.outfit ? [refined.outfit] : [];

      return {
        candidateCount: preparedProducts.length,
        resultCount: outfits[0]?.products.length ?? 0,
        response: {
          query,
          intent: this.mapIntentDto(intent),
          outfits,
          summary: this.buildRefinementSummary(
            refined.refinement,
            outfits.length,
            locale,
          ),
          warnings: refined.warnings,
          extraTips: this.buildExtraTips(refined.warnings, outfits.length, locale),
          refinement: refined.refinement,
        },
      };
    }

    const intent = currentIntent;
    // V2-lite exposes only the highest-ranked candidate. Candidate evaluation
    // remains unchanged so scoring, budget, and stock behavior stay stable.
    const outfits = this.composeOutfits(
      preparedProducts,
      intent,
      request.budget,
      locale,
    ).slice(0, 1);
    const warnings = this.buildWarnings(
      outfits,
      preparedProducts,
      intent,
      locale,
    );
    const summary = this.buildSummary(
      intent,
      outfits.length,
      warnings,
      locale,
      request.budget !== undefined,
    );

    return {
      candidateCount: preparedProducts.length,
      resultCount: outfits[0]?.products.length ?? 0,
      response: {
        query,
        intent: this.mapIntentDto(intent),
        outfits,
        summary,
        warnings,
        extraTips: this.buildExtraTips(warnings, outfits.length, locale),
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

  private parseRefinement(
    query: string,
    requestBudget?: number,
  ): ParsedRefinement {
    const comparable = this.normalizeComparable(query);
    const numberedOption = comparable.match(
      /\b(?:option|outfit|set|goi y)\s*(?:so\s*)?([12])\b/,
    );
    const firstOptionReference =
      /\b(?:cai dau|option dau|outfit dau|set dau|goi y dau)\b/.test(
        comparable,
      );
    const vagueOptionReference =
      /\b(?:option do|outfit do|set do|cai do|goi y do)\b/.test(comparable);
    // Deprecated text compatibility only. Option numbers never select a
    // different source; refinement always edits the one current outfit.
    const legacyOptionReference = Boolean(
      numberedOption || firstOptionReference || vagueOptionReference,
    );
    const keepRoles = new Set<OutfitRole>();
    const replaceRoles = new Set<OutfitRole>();
    const removeRoles = new Set<OutfitRole>();
    const replacementRoleBySource = new Map<OutfitRole, OutfitRole>();
    const replacementTags = new Map<OutfitRole, string[]>();
    const allMentionedRoles = this.findMentionedRoles(comparable);
    const actionMatches = [
      ...comparable.matchAll(
        /\b(?:keep|giu(?: lai)?|change|replace|doi|thay(?: bang)?|remove|bo(?: bot)?|khong can|without|skip|no)\b/g,
      ),
    ];
    let hasKeepKeyword = false;
    let hasReplaceKeyword = false;
    let hasRemoveKeyword = false;

    for (const [index, match] of actionMatches.entries()) {
      const keyword = match[0];
      const start = match.index ?? 0;
      const end = actionMatches[index + 1]?.index ?? comparable.length;
      const actionSegment = comparable.slice(start, end);
      const actionRoles = this.findMentionedRoles(actionSegment);

      if (/^(?:keep|giu(?: lai)?)$/.test(keyword)) {
        hasKeepKeyword = true;
        for (const role of actionRoles) {
          keepRoles.add(role);
        }
      }

      if (/^(?:change|replace|doi|thay(?: bang)?)$/.test(keyword)) {
        hasReplaceKeyword = true;
        for (const role of actionRoles) {
          replaceRoles.add(role);
        }
      }

      if (/^(?:remove|bo(?: bot)?|khong can|without|skip|no)$/.test(keyword)) {
        hasRemoveKeyword = true;
        for (const role of actionRoles) {
          removeRoles.add(role);
        }
      }
    }

    if (hasKeepKeyword && keepRoles.size === 0) {
      for (const role of allMentionedRoles) {
        keepRoles.add(role);
      }
    }
    if (hasReplaceKeyword && replaceRoles.size === 0) {
      for (const role of allMentionedRoles) {
        replaceRoles.add(role);
      }
    }
    if (hasRemoveKeyword && removeRoles.size === 0) {
      for (const role of allMentionedRoles) {
        removeRoles.add(role);
      }
    }

    if (
      hasReplaceKeyword &&
      allMentionedRoles.includes('accessory') &&
      allMentionedRoles.includes('handbag') &&
      /\b(?:bang|with|to|sang)\b/.test(comparable)
    ) {
      replaceRoles.delete('handbag');
      replaceRoles.add('accessory');
      replacementRoleBySource.set('accessory', 'handbag');
    }

    if (hasReplaceKeyword && /\bboots?\b/.test(comparable)) {
      replacementTags.set('shoes', ['boots']);
      replaceRoles.add('shoes');
    }

    const cheaper = /\b(?:cheaper|less expensive|re hon)\b/.test(comparable);
    const hasBudgetWording =
      /\b(?:under|below|duoi|tam|budget|ngan sach)\b/.test(comparable);
    const hasBudgetRefinement =
      cheaper ||
      (requestBudget !== undefined &&
        (hasBudgetWording || legacyOptionReference));
    const hasRoleAction =
      keepRoles.size > 0 || replaceRoles.size > 0 || removeRoles.size > 0;
    const hasRefinementIntent =
      hasRoleAction ||
      hasBudgetRefinement ||
      (legacyOptionReference &&
        (hasKeepKeyword || hasReplaceKeyword || hasRemoveKeyword));
    const requiresPreviousContext =
      legacyOptionReference ||
      hasKeepKeyword ||
      hasReplaceKeyword;
    const targetRoles = [
      ...keepRoles,
      ...replaceRoles,
      ...removeRoles,
      ...replacementRoleBySource.values(),
    ].filter((role, index, roles) => roles.indexOf(role) === index);
    const action: StyleAdviceRefinementAction =
      replaceRoles.size > 0
        ? 'replace'
        : removeRoles.size > 0
          ? 'remove'
          : hasBudgetRefinement
            ? 'budget'
            : keepRoles.size > 0
              ? 'keep'
              : 'fresh';

    return {
      action,
      cheaper,
      legacyOptionReference,
      hasRefinementIntent,
      keepRoles: [...keepRoles],
      removeRoles: [...removeRoles],
      replaceRoles: [...replaceRoles],
      replacementRoleBySource,
      replacementTags,
      requiresPreviousContext,
      targetRoles,
    };
  }

  private findMentionedRoles(comparable: string): OutfitRole[] {
    const roles = new Set<OutfitRole>();

    if (/\b(?:jacket|coat|outerwear|ao khoac)\b/.test(comparable)) {
      roles.add('jacket');
    }
    if (/\b(?:bottom|bottoms|pants|trousers|jeans|quan)\b/.test(comparable)) {
      roles.add('bottom');
    }
    if (/\b(?:shoes?|sneakers?|boots?|giay|doi giay)\b/.test(comparable)) {
      roles.add('shoes');
    }
    if (/\b(?:accessor(?:y|ies)|phu kien|trang suc)\b/.test(comparable)) {
      roles.add('accessory');
    }
    if (
      /\b(?:handbags?|bags?|tui xach)\b/.test(comparable) ||
      (/\btui\b/.test(comparable) &&
        !/\btui\s+(?:muon|can|thich|dang|nen|se|co|khong)\b/.test(
          comparable,
        ))
    ) {
      roles.add('handbag');
    }
    if (
      /\b(?:top|tee|t shirt|tshirt|shirt|ao thun|ao phong|ao)\b/.test(
        comparable,
      ) &&
      !/\bao khoac\b/.test(comparable)
    ) {
      roles.add('top');
    }

    return [...roles];
  }

  private mergeCurrentIntent(
    current: ExtractedIntent,
    previous: NonNullable<NormalizedStyleAdviceRequest['currentOutfit']>['intent'],
  ): ExtractedIntent {
    if (!previous) {
      return current;
    }

    const previousNegativeCategories = (previous.negativeConstraints ?? [])
      .filter((value) => /^no_(?:top|bottom|shoes|jacket|handbag|accessory)$/.test(value))
      .map((value) => value.slice(3) as OutfitRole);
    const previousNegativeTags = (previous.negativeConstraints ?? []).filter(
      (value) => !value.startsWith('no_'),
    );
    const categories = this.mergeTags(previous.categories, current.categories);
    const colors =
      current.colors.length > 0
        ? current.colors
        : this.cleanTags(previous.colors ?? []);
    const styles =
      current.styles.length > 0
        ? current.styles
        : this.cleanTags(previous.styles ?? []);
    const occasions =
      current.occasions.length > 0
        ? current.occasions
        : this.cleanTags(previous.occasions ?? []);
    const fits =
      current.fits.length > 0
        ? current.fits
        : this.cleanTags(previous.fits ?? []);
    const negativeCategories = [
      ...previousNegativeCategories,
      ...current.negativeCategories,
    ].filter((role, index, roles) => roles.indexOf(role) === index);
    const negativeTags = this.mergeTags(
      previousNegativeTags,
      current.negativeTags,
    );

    return {
      categories,
      colors,
      styles,
      occasions,
      fits,
      negativeCategories,
      negativeTags,
      searchTags: this.cleanTags([
        ...categories,
        ...colors,
        ...styles,
        ...occasions,
        ...fits,
        ...current.searchTags,
      ]),
    };
  }

  private mergeTags(
    previous: string[] | undefined,
    current: string[],
  ): string[] {
    return this.cleanTags([...(previous ?? []), ...current]);
  }

  private mapIntentDto(intent: ExtractedIntent): StyleAdviceIntentDto {
    return {
      categories: intent.categories,
      colors: intent.colors,
      styles: intent.styles,
      occasions: intent.occasions,
      fits: intent.fits,
      negativeConstraints: [
        ...intent.negativeCategories.map((role) => `no_${role}`),
        ...intent.negativeTags,
      ],
    };
  }

  private buildMissingContextPayload(
    query: string,
    intent: ExtractedIntent,
    candidateCount: number,
    parsed: ParsedRefinement,
    locale: StyleAdviceLocale,
  ): OutfitRecommendationPayload {
    const warning =
      locale === 'vi'
        ? 'M\u00ecnh ch\u01b0a c\u00f3 outfit hi\u1ec7n t\u1ea1i \u0111\u1ec3 ch\u1ec9nh. B\u1ea1n h\u00e3y t\u1ea1o outfit tr\u01b0\u1edbc, r\u1ed3i y\u00eau c\u1ea7u \u0111\u1ed5i qu\u1ea7n, \u0111\u1ed5i gi\u00e0y ho\u1eb7c b\u1ecf \u00e1o kho\u00e1c.'
        : 'I do not have a current outfit to edit yet. Generate an outfit first, then ask me to change the pants, shoes, or jacket.';

    return {
      candidateCount,
      resultCount: 0,
      response: {
        query,
        intent: this.mapIntentDto(intent),
        outfits: [],
        summary: warning,
        warnings: [warning],
        extraTips: [],
        refinement: {
          applied: false,
          action: 'fresh',
          targetRoles: parsed.targetRoles,
          keptProductIds: [],
          removedProductIds: [],
          replacedProductIds: [],
        },
      },
    };
  }

  private refineCurrentOutfit(
    products: PreparedProduct[],
    intent: ExtractedIntent,
    currentIntent: ExtractedIntent,
    parsed: ParsedRefinement,
    currentOutfit: StyleAdviceCurrentOutfitDto,
    requestBudget: number | undefined,
    carriedBudget: number | undefined,
    locale: StyleAdviceLocale,
  ): RefinedOutfitResult {
    const baseRefinement = {
      action: parsed.action,
      targetRoles: parsed.targetRoles,
    } as const;

    const warnings: string[] = [];

    const productsById = new Map(
      products.map((product) => [product.record.id, product]),
    );
    const selectedByRole = new Map<OutfitRole, ScoredProduct>();
    const sourceProductIds = new Set<string>();
    const removedProductIds = new Set<string>();
    const replacedProductIds = new Set<string>();
    const excludedProductIds = new Set<string>();

    for (const contextProduct of currentOutfit.items) {
      const product = productsById.get(contextProduct.productId);
      sourceProductIds.add(contextProduct.productId);

      if (
        !product ||
        !product.roles.has(contextProduct.role) ||
        selectedByRole.has(contextProduct.role) ||
        [...selectedByRole.values()].some(
          (selected) => selected.product.record.id === contextProduct.productId,
        )
      ) {
        removedProductIds.add(contextProduct.productId);
        warnings.push(
          this.buildCurrentProductUnavailableWarning(
            contextProduct.role,
            locale,
          ),
        );
        continue;
      }

      selectedByRole.set(
        contextProduct.role,
        this.scoreProduct(product, contextProduct.role, intent, 0),
      );
    }

    const sourceTotal = [...selectedByRole.values()].reduce(
      (total, product) => total + product.product.price,
      0,
    );

    for (const role of parsed.removeRoles) {
      const removed = selectedByRole.get(role);
      if (removed) {
        removedProductIds.add(removed.product.record.id);
        excludedProductIds.add(removed.product.record.id);
      }
      selectedByRole.delete(role);
    }

    for (const sourceRole of parsed.replaceRoles) {
      const targetRole = parsed.replacementRoleBySource.get(sourceRole) ?? sourceRole;
      const removed = selectedByRole.get(sourceRole);

      if (removed) {
        removedProductIds.add(removed.product.record.id);
        excludedProductIds.add(removed.product.record.id);
      }
      selectedByRole.delete(sourceRole);

      if (targetRole !== sourceRole && selectedByRole.has(targetRole)) {
        continue;
      }

      const replacementIntent = this.buildReplacementIntent(
        intent,
        currentIntent,
        parsed.replacementTags.get(targetRole) ?? [],
      );
      const replacement = this.selectReplacementProduct(
        products,
        targetRole,
        replacementIntent,
        selectedByRole,
        excludedProductIds,
      );

      if (replacement) {
        selectedByRole.set(targetRole, replacement);
        replacedProductIds.add(replacement.product.record.id);
      } else {
        warnings.push(this.buildReplacementUnavailableWarning(targetRole, locale));
      }
    }

    for (const role of CORE_OUTFIT_ROLES) {
      if (
        selectedByRole.has(role) ||
        parsed.removeRoles.includes(role) ||
        intent.negativeCategories.includes(role)
      ) {
        continue;
      }

      const replacement = this.selectReplacementProduct(
        products,
        role,
        this.buildReplacementIntent(intent, currentIntent, []),
        selectedByRole,
        excludedProductIds,
      );

      if (replacement) {
        selectedByRole.set(role, replacement);
        replacedProductIds.add(replacement.product.record.id);
      } else {
        warnings.push(this.buildReplacementUnavailableWarning(role, locale));
      }
    }

    const budgetTarget =
      requestBudget ??
      (parsed.cheaper && sourceTotal > 0 ? sourceTotal - 1 : carriedBudget);
    const budgetChangedRoles =
      budgetTarget === undefined
        ? []
        : this.applyRefinementBudget(
            products,
            selectedByRole,
            intent,
            new Set(parsed.keepRoles),
            excludedProductIds,
            removedProductIds,
            replacedProductIds,
            budgetTarget,
          );
    const totalPrice = [...selectedByRole.values()].reduce(
      (total, product) => total + product.product.price,
      0,
    );

    if (budgetTarget !== undefined && totalPrice > budgetTarget) {
      warnings.push(
        parsed.cheaper && requestBudget === undefined
          ? this.buildNoCheaperOutfitWarning(locale)
          : this.buildBudgetWarning(budgetTarget, locale),
      );
    }

    const orderedProducts = this.orderRefinedProducts(selectedByRole);
    const outfitProducts = orderedProducts.map((product) =>
      this.mapOutfitProduct(product),
    );
    const keptProductIds = outfitProducts
      .map((product) => product.productId)
      .filter((productId) => sourceProductIds.has(productId));
    const targetRoles = [
      ...parsed.targetRoles,
      ...budgetChangedRoles,
    ].filter((role, index, roles) => roles.indexOf(role) === index);
    const refinement: StyleAdviceRefinementDto = {
      applied: true,
      ...baseRefinement,
      targetRoles,
      keptProductIds,
      removedProductIds: [...removedProductIds],
      replacedProductIds: [...replacedProductIds],
    };

    if (orderedProducts.length === 0) {
      return { refinement, warnings };
    }

    const scoreTotal = orderedProducts.reduce(
      (total, product) => total + product.score,
      0,
    );
    const outfit: StyleAdviceOutfitDto = {
      title: this.buildOutfitTitle(intent, 1, locale),
      reason: this.buildOutfitReason(intent, outfitProducts, warnings, locale),
      score: Math.min(
        100,
        Math.max(0, Math.round(scoreTotal / orderedProducts.length)),
      ),
      matchedIntentTags: this.cleanTags(
        this.getMatchedIntentTags(outfitProducts, intent),
      ),
      products: outfitProducts,
      warnings: [...new Set(warnings)],
    };

    return {
      outfit,
      refinement,
      warnings: [...new Set(warnings)],
    };
  }

  private buildReplacementIntent(
    merged: ExtractedIntent,
    current: ExtractedIntent,
    exactCategoryTags: string[],
  ): ExtractedIntent {
    return {
      ...merged,
      colors: current.colors.length > 0 ? current.colors : merged.colors,
      styles: current.styles.length > 0 ? current.styles : merged.styles,
      occasions:
        current.occasions.length > 0 ? current.occasions : merged.occasions,
      fits: current.fits.length > 0 ? current.fits : merged.fits,
      categories: this.cleanTags([
        ...merged.categories,
        ...exactCategoryTags,
      ]),
      searchTags: this.cleanTags([
        ...merged.searchTags,
        ...exactCategoryTags,
      ]),
    };
  }

  private selectReplacementProduct(
    products: PreparedProduct[],
    role: OutfitRole,
    intent: ExtractedIntent,
    selectedByRole: Map<OutfitRole, ScoredProduct>,
    excludedProductIds: Set<string>,
  ): ScoredProduct | undefined {
    const selectedIds = new Set(
      [...selectedByRole.values()].map((product) => product.product.record.id),
    );

    return this.scoreProductsForRole(products, role, intent).find(
      (candidate) =>
        !selectedIds.has(candidate.product.record.id) &&
        !excludedProductIds.has(candidate.product.record.id),
    );
  }

  private applyRefinementBudget(
    products: PreparedProduct[],
    selectedByRole: Map<OutfitRole, ScoredProduct>,
    intent: ExtractedIntent,
    keepRoles: Set<OutfitRole>,
    excludedProductIds: Set<string>,
    removedProductIds: Set<string>,
    replacedProductIds: Set<string>,
    budgetTarget: number,
  ): OutfitRole[] {
    const currentProducts = this.orderRefinedProducts(selectedByRole);
    const currentTotal = currentProducts.reduce(
      (sum, product) => sum + product.product.price,
      0,
    );

    if (currentTotal <= budgetTarget) {
      return [];
    }

    const choicesByRole = currentProducts.map((currentProduct) => {
      if (keepRoles.has(currentProduct.role)) {
        return [currentProduct] as Array<ScoredProduct | undefined>;
      }

      const scored = this.scoreProductsForRole(
        products,
        currentProduct.role,
        intent,
      ).filter(
        (candidate) =>
          candidate.product.record.id !== currentProduct.product.record.id &&
          !excludedProductIds.has(candidate.product.record.id),
      );
      const cheapest = [...scored]
        .sort(
          (left, right) =>
            left.product.price - right.product.price ||
            this.compareScoredProducts(left, right),
        )
        .slice(0, 2);
      const alternatives = [...scored.slice(0, 2), ...cheapest].filter(
        (candidate, index, candidates) =>
          candidates.findIndex(
            (entry) => entry.product.record.id === candidate.product.record.id,
          ) === index,
      );
      const choices: Array<ScoredProduct | undefined> = [
        currentProduct,
        ...alternatives,
      ];

      if (['jacket', 'accessory', 'handbag'].includes(currentProduct.role)) {
        choices.push(undefined);
      }

      return choices;
    });
    let best:
      | {
          changes: number;
          products: ScoredProduct[];
          score: number;
          total: number;
        }
      | undefined;
    let closestOver:
      | {
          changes: number;
          products: ScoredProduct[];
          score: number;
          total: number;
        }
      | undefined;

    const search = (
      roleIndex: number,
      selected: ScoredProduct[],
      selectedIds: Set<string>,
      changes: number,
      total: number,
      score: number,
    ) => {
      if (best && changes > best.changes) {
        return;
      }

      if (roleIndex === currentProducts.length) {
        if (total <= budgetTarget) {
          if (
            !best ||
            changes < best.changes ||
            (changes === best.changes && score > best.score) ||
            (changes === best.changes && score === best.score && total > best.total)
          ) {
            best = { changes, products: [...selected], score, total };
          }
        } else if (
          !best &&
          (!closestOver ||
            total < closestOver.total ||
            (total === closestOver.total && changes < closestOver.changes) ||
            (total === closestOver.total &&
              changes === closestOver.changes &&
              score > closestOver.score))
        ) {
          closestOver = { changes, products: [...selected], score, total };
        }
        return;
      }

      const currentProduct = currentProducts[roleIndex];
      for (const choice of choicesByRole[roleIndex]) {
        if (choice && selectedIds.has(choice.product.record.id)) {
          continue;
        }

        const changed =
          !choice ||
          choice.product.record.id !== currentProduct.product.record.id;
        if (choice) {
          selected.push(choice);
          selectedIds.add(choice.product.record.id);
        }
        search(
          roleIndex + 1,
          selected,
          selectedIds,
          changes + (changed ? 1 : 0),
          total + (choice?.product.price ?? 0),
          score + (choice?.score ?? 0),
        );
        if (choice) {
          selected.pop();
          selectedIds.delete(choice.product.record.id);
        }
      }
    };

    search(0, [], new Set<string>(), 0, 0, 0);

    const selectedBudgetResult = best ?? closestOver;

    if (!selectedBudgetResult) {
      return [];
    }

    const bestByRole = new Map(
      selectedBudgetResult.products.map((product) => [product.role, product]),
    );
    const changedRoles: OutfitRole[] = [];

    for (const currentProduct of currentProducts) {
      const replacement = bestByRole.get(currentProduct.role);
      if (
        replacement?.product.record.id === currentProduct.product.record.id
      ) {
        continue;
      }

      changedRoles.push(currentProduct.role);
      removedProductIds.add(currentProduct.product.record.id);
      excludedProductIds.add(currentProduct.product.record.id);
      replacedProductIds.delete(currentProduct.product.record.id);

      if (replacement) {
        selectedByRole.set(currentProduct.role, replacement);
        replacedProductIds.add(replacement.product.record.id);
      } else {
        selectedByRole.delete(currentProduct.role);
      }
    }

    return changedRoles;
  }

  private orderRefinedProducts(
    selectedByRole: Map<OutfitRole, ScoredProduct>,
  ): ScoredProduct[] {
    return OUTFIT_ROLE_ORDER
      .map((role) => selectedByRole.get(role))
      .filter((product): product is ScoredProduct => Boolean(product));
  }

  private buildCurrentProductUnavailableWarning(
    role: OutfitRole,
    locale: StyleAdviceLocale,
  ): string {
    const roleLabel = this.localizedLabel(role, locale);
    return locale === 'vi'
      ? `${this.toTitleCase(roleLabel)} trong outfit hi\u1ec7n t\u1ea1i kh\u00f4ng c\u00f2n kh\u1ea3 d\u1ee5ng, n\u00ean m\u00ecnh \u0111\u00e3 b\u1ecf m\u00f3n \u0111\u00f3 v\u00e0 t\u00ecm l\u1ef1a ch\u1ecdn c\u00f2n h\u00e0ng khi c\u1ea7n.`
      : `The current ${roleLabel} is no longer active and in stock, so I removed it and looked for an available replacement where needed.`;
  }

  private buildReplacementUnavailableWarning(
    role: OutfitRole,
    locale: StyleAdviceLocale,
  ): string {
    const roleLabel = this.localizedLabel(role, locale);
    return locale === 'vi'
      ? `Kh\u00f4ng t\u00ecm \u0111\u01b0\u1ee3c ${roleLabel} thay th\u1ebf c\u00f2n h\u00e0ng ph\u00f9 h\u1ee3p.`
      : `No suitable active in-stock replacement ${roleLabel} was available.`;
  }

  private buildNoCheaperOutfitWarning(locale: StyleAdviceLocale): string {
    return locale === 'vi'
      ? 'M\u00ecnh ch\u01b0a t\u00ecm \u0111\u01b0\u1ee3c outfit r\u1ebb h\u01a1n t\u1eeb c\u00e1c s\u1ea3n ph\u1ea9m \u0111ang c\u00f2n h\u00e0ng, n\u00ean \u0111\u00e2y l\u00e0 l\u1ef1a ch\u1ecdn g\u1ea7n nh\u1ea5t.'
      : 'I could not find a cheaper outfit from the active in-stock catalog, so this is the closest available option.';
  }

  private buildRefinementSummary(
    refinement: StyleAdviceRefinementDto,
    outfitCount: number,
    locale: StyleAdviceLocale,
  ): string {
    if (!refinement.applied || outfitCount === 0) {
      return locale === 'vi'
        ? 'M\u00ecnh ch\u01b0a th\u1ec3 \u00e1p d\u1ee5ng y\u00eau c\u1ea7u ch\u1ec9nh outfit n\u00e0y.'
        : 'I could not apply this outfit refinement.';
    }

    return locale === 'vi'
      ? 'M\u00ecnh \u0111\u00e3 ch\u1ec9nh outfit hi\u1ec7n t\u1ea1i theo y\u00eau c\u1ea7u m\u1edbi v\u00e0 ki\u1ec3m tra l\u1ea1i t\u1ed3n kho.'
      : 'I refined the current outfit with your new request and rechecked current availability.';
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
    locale: StyleAdviceLocale = 'en',
  ): StyleAdviceOutfitDto[] {
    const scoredByRole = new Map<OutfitRole, ScoredProduct[]>();

    for (const role of CORE_OUTFIT_ROLES) {
      scoredByRole.set(role, this.scoreProductsForRole(products, role, intent));
    }

    scoredByRole.set('shoes', this.scoreProductsForRole(products, 'shoes', intent));

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
      return this.composeIncompleteOutfit(
        scoredByRole,
        intent,
        budgetMax,
        locale,
      );
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
        locale,
      ),
    );
  }

  private buildCoreOutfitCandidates(
    scoredByRole: Map<OutfitRole, ScoredProduct[]>,
  ): CoreOutfitCandidate[] {
    const [tops, bottoms] = CORE_OUTFIT_ROLES.map((role) =>
      this.limitCoreRoleCandidates(scoredByRole.get(role) ?? []),
    );

    if (tops.length === 0 || bottoms.length === 0) {
      return [];
    }

    const candidates: CoreOutfitCandidate[] = [];

    for (const top of tops) {
      for (const bottom of bottoms) {
        if (top.product.record.id === bottom.product.record.id) {
          continue;
        }

        candidates.push(this.createCoreOutfitCandidate([top, bottom]));
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
    const [tops, bottoms] = CORE_OUTFIT_ROLES.map(
      (role) => scoredByRole.get(role) ?? [],
    );
    const affordable: CoreOutfitCandidate[] = [];

    for (const top of tops) {
      for (const bottom of bottoms) {
        if (top.product.record.id === bottom.product.record.id) {
          continue;
        }

        if (top.product.price + bottom.product.price > budgetMax) {
          continue;
        }

        this.retainBestCoreCandidate(
          affordable,
          this.createCoreOutfitCandidate([top, bottom]),
        );
      }
    }

    if (affordable.length > 0) {
      return { affordable };
    }

    const closestOverBudget = this.findLowestPricedCoreCandidate(tops, bottoms);

    return { affordable, ...(closestOverBudget ? { closestOverBudget } : {}) };
  }

  private findLowestPricedCoreCandidate(
    tops: ScoredProduct[],
    bottoms: ScoredProduct[],
  ): CoreOutfitCandidate | undefined {
    let closest: CoreOutfitCandidate | undefined;

    for (const top of tops) {
      for (const bottom of bottoms) {
        if (top.product.record.id === bottom.product.record.id) {
          continue;
        }

        const candidate = this.createCoreOutfitCandidate([top, bottom]);

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
    products: ScoredProduct[],
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
    locale: StyleAdviceLocale,
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
          this.buildWeakRoleWarning(product.role, locale),
      );
    let totalPrice = candidate.totalPrice;

    const shoes = this.pickForRole(
      scoredByRole.get('shoes') ?? [],
      optionNumber - 1,
      selectedIds,
    );
    totalPrice = this.addOptionalProduct(
      shoes,
      intent,
      budgetMax,
      selectedIds,
      selectedRoles,
      selectedProducts,
      totalPrice,
    );

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
      outfitWarnings.unshift(this.buildBudgetWarning(budgetMax, locale));
    }

    const uniqueProducts = this.keepHighestScoringProductPerRole(selectedProducts);
    const outfitProducts = uniqueProducts.map((product) => this.mapOutfitProduct(product));
    const scoreTotal = uniqueProducts.reduce((total, product) => total + product.score, 0);

    return {
      title: this.buildOutfitTitle(intent, optionNumber, locale),
      reason: this.buildOutfitReason(
        intent,
        outfitProducts,
        outfitWarnings,
        locale,
      ),
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
    locale: StyleAdviceLocale = 'en',
  ): StyleAdviceOutfitDto[] {
    const selectedIds = new Set<string>();
    const selectedProducts: ScoredProduct[] = [];
    const outfitWarnings: string[] = [];
    let totalPrice = 0;

    for (const role of CORE_OUTFIT_ROLES) {
      const scoredProduct = this.pickForRole(
        scoredByRole.get(role) ?? [],
        0,
        selectedIds,
      );

      if (!scoredProduct) {
        outfitWarnings.push(this.buildUnavailableRoleWarning(role, locale));
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
        outfitWarnings.push(this.buildWeakRoleWarning(role, locale));
      }
    }

    if (selectedProducts.length === 0) {
      return [];
    }

    if (budgetMax !== undefined) {
      outfitWarnings.unshift(this.buildBudgetWarning(budgetMax, locale));
    }

    const uniqueProducts = this.keepHighestScoringProductPerRole(selectedProducts);
    const outfitProducts = uniqueProducts.map((product) => this.mapOutfitProduct(product));
    const scoreTotal = uniqueProducts.reduce((total, product) => total + product.score, 0);

    return [
      {
        title: this.buildOutfitTitle(intent, 1, locale),
        reason: this.buildOutfitReason(
          intent,
          outfitProducts,
          outfitWarnings,
          locale,
        ),
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

  private buildBudgetWarning(
    budgetMax: number,
    locale: StyleAdviceLocale,
  ): string {
    const formattedBudget = new Intl.NumberFormat(
      locale === 'vi' ? 'vi-VN' : 'en-US',
    ).format(budgetMax);

    return locale === 'vi'
      ? `Không tìm được outfit hoàn chỉnh dưới ${formattedBudget} VND. Đang hiển thị lựa chọn gần nhất.`
      : `No complete outfit under ${formattedBudget} VND was found. Showing the closest available option.`;
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
      .filter(
        (product) =>
          product.roles.has(role) && this.productCanServeRole(product, role),
      )
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

    if (role === 'top') {
      if (this.hasPreferredTopSignal(product)) {
        score += 24;
      } else {
        score -= 18;
      }
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
    const roles = this.detectRoles(
      tagSet,
      categoryTags,
      product.name,
      product.slug,
    );
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
    name: string,
    slug: string,
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

    const dominantRole = this.getDominantRoleFromSignals(categoryTags, name, slug);
    if (dominantRole) {
      roles.add(dominantRole);
    }

    return roles;
  }

  private productCanServeRole(product: PreparedProduct, role: OutfitRole): boolean {
    const dominantRole = this.getDominantProductRole(product);

    return dominantRole === undefined || dominantRole === role;
  }

  private getDominantProductRole(product: PreparedProduct): OutfitRole | undefined {
    return this.getDominantRoleFromSignals(
      product.categoryTags,
      product.record.name,
      product.record.slug,
    );
  }

  private getDominantRoleFromSignals(
    categoryTags: Set<string>,
    name: string,
    slug: string,
  ): OutfitRole | undefined {
    const text = this.normalizeComparable(`${name} ${slug}`);
    const hasCategory = (tag: string) => categoryTags.has(tag);

    if (
      hasCategory('bottoms') ||
      /\b(?:bottoms?|pants?|trousers?|jeans?|denim|shorts?|skirts?|quan)\b/.test(
        text,
      )
    ) {
      return 'bottom';
    }

    if (
      hasCategory('jacket') ||
      hasCategory('outerwear') ||
      /\b(?:jackets?|outerwear|coats?|blazers?|overshirts?|cardigans?|biker)\b/.test(
        text,
      )
    ) {
      return 'jacket';
    }

    if (
      hasCategory('shoes') ||
      /\b(?:shoes?|sneakers?|boots?|loafers?|slippers?|giay)\b/.test(text)
    ) {
      return 'shoes';
    }

    if (/\b(?:handbags?|bags?|totes?|crossbody|tui|xach)\b/.test(text)) {
      return 'handbag';
    }

    if (
      hasCategory('accessories') ||
      /\b(?:accessor(?:y|ies)|belts?|rings?|bracelets?|watches?|necklaces?|beanies?|sunglasses|phu kien)\b/.test(
        text,
      )
    ) {
      return 'accessory';
    }

    if (
      hasCategory('top') ||
      hasCategory('tops') ||
      this.hasPreferredTopSignalFromSignals(categoryTags, name, slug)
    ) {
      return 'top';
    }

    return undefined;
  }

  private hasPreferredTopSignal(product: PreparedProduct): boolean {
    return this.hasPreferredTopSignalFromSignals(
      product.categoryTags,
      product.record.name,
      product.record.slug,
      product.tagSet,
    );
  }

  private hasPreferredTopSignalFromSignals(
    categoryTags: Set<string>,
    name: string,
    slug: string,
    tagSet = new Set<string>(),
  ): boolean {
    const text = this.normalizeComparable(`${name} ${slug}`);

    return (
      PREFERRED_TOP_TAGS.some(
        (tag) => tagSet.has(tag) || categoryTags.has(tag),
      ) ||
      PREFERRED_TOP_ALIASES.some((alias) =>
        this.hasAlias(text, this.normalizeComparable(alias)),
      )
    );
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

  private buildWarnings(
    outfits: StyleAdviceOutfitDto[],
    products: PreparedProduct[],
    intent: ExtractedIntent,
    locale: StyleAdviceLocale,
  ): string[] {
    const warnings = new Set<string>();

    if (products.length === 0) {
      warnings.add(
        locale === 'vi'
          ? 'Hiện chưa có sản phẩm còn hàng phù hợp để tạo outfit.'
          : 'No active in-stock products were available for outfit matching.',
      );
    }

    if (products.every((product) => product.tagSet.size === 0)) {
      warnings.add(
        locale === 'vi'
          ? 'Các sản phẩm đang còn hàng chưa có đủ thông tin phối đồ để tạo gợi ý phù hợp.'
          : 'Available products do not currently have enough styling information for outfit matching.',
      );
    }

    for (const role of CORE_OUTFIT_ROLES) {
      if (intent.negativeCategories.includes(role)) {
        continue;
      }

      if (!products.some((product) => product.roles.has(role))) {
        warnings.add(this.buildUnavailableRoleWarning(role, locale));
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
    locale: StyleAdviceLocale,
    hasBudget: boolean,
  ): string {
    if (outfitCount === 0) {
      return locale === 'vi'
        ? 'Mình chưa thể tạo outfit phù hợp từ các sản phẩm đang còn hàng. Bạn có thể thử nới ngân sách hoặc mô tả rộng hơn.'
        : 'I could not build an outfit from the active in-stock products for that prompt. Try broadening the budget or description.';
    }

    const criteria = this.buildSummaryCriteria(intent, hasBudget, locale);
    const base =
      locale === 'vi'
        ? `Mình đã tạo ${outfitCount} gợi ý outfit dựa trên ${criteria} bạn đưa ra.`
        : `I built ${outfitCount} outfit option${outfitCount === 1 ? '' : 's'} based on your requested ${criteria}.`;

    return warnings.length > 0
      ? locale === 'vi'
        ? `${base} Một vài hạng mục dùng lựa chọn còn hàng gần nhất.`
        : `${base} Some categories use the closest available match.`
      : base;
  }

  private buildExtraTips(
    warnings: string[],
    outfitCount: number,
    locale: StyleAdviceLocale,
  ): string[] {
    if (outfitCount === 0) {
      return locale === 'vi'
        ? [
            'Hãy thử thêm màu sắc, phong cách, dịp sử dụng hoặc món chính như áo thun, quần jeans hay giày.',
          ]
        : [
            'Try adding a color, style, occasion, or core item such as a tee, jeans, or shoes.',
          ];
    }

    return [
      locale === 'vi'
        ? 'Bạn có thể bấm vào từng sản phẩm để xem size, màu và tồn kho trước khi thêm vào giỏ.'
        : 'Open each product to confirm the current color, size, and price before adding it to your cart.',
      ...warnings.slice(0, 2),
    ];
  }

  private buildOutfitTitle(
    intent: ExtractedIntent,
    optionNumber: number,
    locale: StyleAdviceLocale,
  ): string {
    const labels = this.cleanTags([
      ...intent.colors.slice(0, 1),
      ...intent.styles.slice(0, 1),
      ...intent.occasions.slice(0, 1),
    ]);
    const localizedLabels = labels.map((tag) =>
      this.localizedLabel(tag, locale),
    );

    if (locale === 'vi') {
      return `Gợi ý ${optionNumber}: Outfit ${localizedLabels.join(' ') || 'phù hợp với yêu cầu'}`;
    }

    const titleBase =
      localizedLabels.length > 0
        ? localizedLabels.map((label) => this.toTitleCase(label)).join(' ')
        : 'Belikeme';

    return `Option ${optionNumber}: ${titleBase} outfit`;
  }

  private buildOutfitReason(
    intent: ExtractedIntent,
    products: StyleAdviceOutfitProductDto[],
    warnings: string[],
    locale: StyleAdviceLocale,
  ): string {
    const matches = this.cleanTags(this.getMatchedIntentTags(products, intent));
    const productRoles = this.cleanTags(products.map((product) => product.role));
    const roleList = this.joinLocalizedList(
      productRoles.map((role) => this.localizedLabel(role, locale)),
      locale,
    );

    if (matches.length === 0) {
      if (locale === 'vi') {
        return warnings.length > 0
          ? `Set này kết hợp ${roleList} từ những lựa chọn còn hàng gần nhất.`
          : `Set này kết hợp ${roleList} từ các sản phẩm Belikeme đang còn hàng.`;
      }

      return warnings.length > 0
        ? `This set combines ${roleList} from the closest available in-stock options.`
        : `This set combines ${roleList} from active in-stock Belikeme products.`;
    }

    const matchList = this.joinLocalizedList(
      matches.map((tag) => this.localizedLabel(tag, locale)),
      locale,
    );

    return locale === 'vi'
      ? `Set này kết hợp ${roleList} và ưu tiên ${matchList} để giữ đúng yêu cầu của bạn.`
      : `This set combines ${roleList} and prioritizes ${matchList} to match your request.`;
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
    if (
      tag === 'blue' &&
      comparableAlias === 'xanh' &&
      /\bxanh\s+(?:la|luc|reu)\b/.test(comparablePrompt)
    ) {
      return false;
    }

    if (
      tag === 'top' &&
      comparableAlias === 'ao' &&
      /\bao\s+(?:khoac|thun|phong|tay dai|ba lo|tank)\b/.test(
        comparablePrompt,
      )
    ) {
      return false;
    }

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
    const negativePrefix =
      '(?:no|without|skip|khong(?: can)?|bo|dung(?: them)?)';

    if (
      new RegExp(
        `\\b${negativePrefix}\\s+(?:jacket|coat|outerwear|ao khoac)\\b`,
      ).test(comparablePrompt)
    ) {
      negatives.add('jacket');
    }

    if (
      new RegExp(
        `\\b${negativePrefix}\\s+(?:accessories|accessory|belt|ring|bracelet|phu kien|trang suc)\\b`,
      ).test(comparablePrompt)
    ) {
      negatives.add('accessory');
    }

    if (
      new RegExp(
        `\\b${negativePrefix}\\s+(?:bag|handbag|tote|tui|tui xach)\\b`,
      ).test(comparablePrompt)
    ) {
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

    if (
      /\b(?:not too loud|not too flashy|not flashy|not loud|simple|khong qua noi|khong loe loet|khong qua lo|khong qua loe loet)\b/.test(
        comparablePrompt,
      )
    ) {
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

  private buildWeakRoleWarning(
    role: OutfitRole,
    locale: StyleAdviceLocale,
  ): string {
    const roleLabel = this.localizedLabel(role, locale);

    return locale === 'vi'
      ? `Không tìm được ${roleLabel} phù hợp mạnh với yêu cầu này, nên set dùng lựa chọn còn hàng gần nhất.`
      : `No strong ${roleLabel} match was found, so this set uses the closest in-stock option.`;
  }

  private buildUnavailableRoleWarning(
    role: OutfitRole,
    locale: StyleAdviceLocale,
  ): string {
    const roleLabel = this.localizedLabel(role, locale);

    return locale === 'vi'
      ? `Không tìm được ${roleLabel} còn hàng phù hợp với yêu cầu này.`
      : `No active in-stock ${roleLabel} was available for this request.`;
  }

  private buildSummaryCriteria(
    intent: ExtractedIntent,
    hasBudget: boolean,
    locale: StyleAdviceLocale,
  ): string {
    const criteria: string[] = [];

    if (intent.colors.length > 0) {
      criteria.push(locale === 'vi' ? 'màu sắc' : 'color');
    }

    if (intent.styles.length > 0 || intent.fits.length > 0) {
      criteria.push(locale === 'vi' ? 'phong cách' : 'style');
    }

    if (intent.occasions.length > 0) {
      criteria.push(locale === 'vi' ? 'dịp sử dụng' : 'occasion');
    }

    if (hasBudget) {
      criteria.push(locale === 'vi' ? 'ngân sách' : 'budget');
    }

    return criteria.length > 0
      ? this.joinLocalizedList(criteria, locale)
      : locale === 'vi'
        ? 'các tiêu chí'
        : 'preferences';
  }

  private joinLocalizedList(
    values: string[],
    locale: StyleAdviceLocale,
  ): string {
    const uniqueValues = [...new Set(values)];

    if (uniqueValues.length <= 1) {
      return uniqueValues[0] ?? '';
    }

    if (uniqueValues.length === 2) {
      return uniqueValues.join(locale === 'vi' ? ' và ' : ' and ');
    }

    const lastValue = uniqueValues[uniqueValues.length - 1];
    const firstValues = uniqueValues.slice(0, -1).join(', ');

    return locale === 'vi'
      ? `${firstValues} và ${lastValue}`
      : `${firstValues}, and ${lastValue}`;
  }

  private buildPrompt(request: NormalizedStyleAdviceRequest): string {
    if (request.message) {
      return request.message;
    }

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

  private localizedLabel(tag: string, locale: StyleAdviceLocale): string {
    const normalizedTag = this.normalizeTag(tag);

    return locale === 'vi'
      ? VIETNAMESE_LABELS[normalizedTag] ??
          normalizedTag.replace(/_/g, ' ')
      : this.cleanLabel(normalizedTag);
  }

  private toTitleCase(value: string): string {
    return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }
}
