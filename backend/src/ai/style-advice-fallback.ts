import type { AiCatalogCandidate } from './ai-context.mapper';
import type { NormalizedStyleAdviceRequest } from './dto/style-advice.dto';

type OutfitRole = 'top' | 'bottom' | 'outerwear' | 'dress' | 'accessory';
type StyleLocale = 'en' | 'vi';

interface StyleConcept {
  id: string;
  label: Record<StyleLocale, string>;
  promptPattern: RegExp;
  positiveTerms: string[];
  negativeTerms?: string[];
}

interface ScoredCandidate {
  candidate: AiCatalogCandidate;
  index: number;
  matchedLabels: string[];
  role?: OutfitRole;
  score: number;
}

export interface RankedFallbackRecommendation {
  candidate: AiCatalogCandidate;
  reason: string;
  stylingTip?: string;
}

export function getStyleCandidateRole(
  candidate: AiCatalogCandidate,
): OutfitRole | undefined {
  return detectRole(buildCandidateText(candidate));
}

const STYLE_CONCEPTS: StyleConcept[] = [
  {
    id: 'minimal',
    label: { en: 'a minimal look', vi: 'phong cách tối giản' },
    promptPattern: /\b(?:minimal|minimalist|toi gian|don gian|basic)\b/,
    positiveTerms: [
      'minimal',
      'clean',
      'simple',
      'solid',
      'neutral',
      'classic',
      'basic',
      'plain',
      'monochrome',
      'leather',
    ],
    negativeTerms: [
      'camo',
      'camouflage',
      'graphic',
      'logo',
      'supreme',
      'nike',
      'distressed',
      'embellished',
    ],
  },
  {
    id: 'streetwear',
    label: { en: 'streetwear', vi: 'phong cách streetwear' },
    promptPattern: /\b(?:streetwear|street style|duong pho|hip hop)\b/,
    positiveTerms: [
      'streetwear',
      'baggy',
      'oversized',
      'boxy',
      'camo',
      'graphic',
      'hoodie',
      'sweater',
      'jacket',
      'cargo',
      'denim',
      'sneaker',
    ],
  },
  {
    id: 'oversized',
    label: { en: 'an oversized fit', vi: 'phom dáng oversized' },
    promptPattern: /\b(?:oversized|over size|rong rai|form rong|baggy)\b/,
    positiveTerms: ['oversized', 'baggy', 'boxy', 'relaxed', 'loose', 'wide-leg'],
  },
  {
    id: 'going-out',
    label: { en: 'going out', vi: 'đi chơi' },
    promptPattern: /\b(?:going out|hangout|weekend|di choi|dao pho)\b/,
    positiveTerms: [
      'casual',
      'relaxed',
      'comfortable',
      'tee',
      'shirt',
      'short',
      'jacket',
      'sweater',
      'denim',
      'skirt',
      'dress',
    ],
  },
  {
    id: 'date-night',
    label: { en: 'a date-night look', vi: 'một buổi hẹn' },
    promptPattern: /\b(?:date night|date|hen ho|buoi hen)\b/,
    positiveTerms: [
      'elegant',
      'polished',
      'satin',
      'dress',
      'skirt',
      'fitted',
      'cardigan',
      'blazer',
      'leather',
    ],
  },
  {
    id: 'coffee',
    label: { en: 'a coffee outing', vi: 'đi cà phê' },
    promptPattern: /\b(?:coffee|cafe|ca phe)\b/,
    positiveTerms: [
      'casual',
      'relaxed',
      'soft',
      'tee',
      'cardigan',
      'chino',
      'denim',
      'tote',
    ],
  },
  {
    id: 'work',
    label: { en: 'work', vi: 'đi làm' },
    promptPattern: /\b(?:work|office|business|di lam|cong so)\b/,
    positiveTerms: [
      'office',
      'tailored',
      'polished',
      'oxford',
      'shirt',
      'chino',
      'trouser',
      'blazer',
      'belt',
    ],
  },
  {
    id: 'school',
    label: { en: 'school', vi: 'đi học' },
    promptPattern: /\b(?:school|class|university|college|di hoc)\b/,
    positiveTerms: [
      'casual',
      'comfortable',
      'tee',
      'shirt',
      'cardigan',
      'overshirt',
      'chino',
      'pants',
      'tote',
    ],
  },
  {
    id: 'party',
    label: { en: 'a party', vi: 'đi tiệc' },
    promptPattern: /\b(?:party|wedding|event|di tiec|dam cuoi|su kien)\b/,
    positiveTerms: [
      'elegant',
      'polished',
      'satin',
      'dress',
      'skirt',
      'blazer',
      'tailored',
      'leather',
    ],
  },
];

const ROLE_PATTERNS: Array<{ pattern: RegExp; role: OutfitRole }> = [
  {
    role: 'outerwear',
    pattern: /\b(?:outerwear|jacket|coat|blazer|overshirt|ao khoac)\b/,
  },
  {
    role: 'bottom',
    pattern:
      /\b(?:bottoms?|pants?|trousers?|jeans?|shorts?|chino|skirt|quan|chan vay)\b/,
  },
  {
    role: 'dress',
    pattern: /\b(?:dress|gown|dam|vay lien)\b/,
  },
  {
    role: 'accessory',
    pattern:
      /\b(?:accessories|accessory|bag|belt|gloves?|hat|cap|tote|handbag|phu kien|tui xach|tui deo|that lung|gang tay|non)\b/,
  },
  {
    role: 'top',
    pattern:
      /\b(?:tops?|shirts?|t-?shirts?|tees?|sweaters?|hoodies?|cardigans?|tanks?|blouses?|ao(?! khoac)|ao thun|ao phong|ao len|so mi)\b/,
  },
];

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'cho',
  'cua',
  'di',
  'for',
  'give',
  'goi',
  'help',
  'i',
  'la',
  'look',
  'me',
  'mot',
  'please',
  'recommend',
  'suggest',
  'that',
  'the',
  'this',
  'toi',
  'tui',
  'want',
  'with',
  'you',
]);

const OUTFIT_PATTERN =
  /\b(?:outfit|full look|complete look|trang phuc|phoi do|set do|mac gi)\b/;

export function inferBudgetFromStylePrompt(
  request: NormalizedStyleAdviceRequest,
): number | undefined {
  if (request.budget !== undefined) {
    return request.budget;
  }

  const comparable = normalizeComparable(
    [request.occasion, request.style, request.notes]
      .filter((value): value is string => Boolean(value))
      .join(' '),
  );
  const constrainedBudget = comparable.match(
    /\b(?:budget|ngan sach|under|below|max|maximum|duoi|toi da|khong qua)\s*(?:la|of)?\s*([0-9]+(?:[.,][0-9]+)*)\s*(tram nghin|tram ngan|tram|nghin|ngan|k|trieu|m|million|vnd|dong|d)?\b/,
  );
  const shorthandBudget = comparable.match(
    /\b([0-9]+(?:[.,][0-9]+)*)\s*(tram nghin|tram ngan|tram|nghin|ngan|k|trieu|m|million)\b/,
  );
  const match = constrainedBudget ?? shorthandBudget;

  if (!match) {
    return undefined;
  }

  return parseBudgetValue(match[1], match[2]);
}

export function rankStyleFallbackCandidates(
  candidates: AiCatalogCandidate[],
  request: NormalizedStyleAdviceRequest,
  limit = 4,
): RankedFallbackRecommendation[] {
  const prompt = buildPrompt(request);
  const comparablePrompt = normalizeComparable(prompt);
  const locale = detectLocale(prompt);
  const concepts = STYLE_CONCEPTS.filter((concept) =>
    concept.promptPattern.test(comparablePrompt),
  );
  const requestedRoles = ROLE_PATTERNS.filter(({ pattern }) =>
    pattern.test(comparablePrompt),
  ).map(({ role }) => role);
  const promptTokens = tokenize(comparablePrompt);
  const requestedColors = extractRequestedColors(prompt);
  const wantsOutfit =
    OUTFIT_PATTERN.test(comparablePrompt) || requestedRoles.length === 0;

  const scored = candidates
    .map((candidate, index) => {
      const contextText = buildCandidateText(candidate);
      const role = detectRole(contextText);
      const matchedLabels: string[] = [];
      let score = 0;

      for (const token of promptTokens) {
        if (contextText.includes(token)) {
          score += token.length >= 5 ? 4 : 2;
        }
      }

      for (const concept of concepts) {
        const positiveMatches = concept.positiveTerms.filter((term) =>
          contextText.includes(term),
        ).length;
        const negativeMatches = (concept.negativeTerms ?? []).filter((term) =>
          contextText.includes(term),
        ).length;

        if (positiveMatches > 0) {
          score += Math.min(positiveMatches, 3) * 5;
          matchedLabels.push(concept.label[locale]);
        }

        score -= negativeMatches * 7;
      }

      if (role && requestedRoles.includes(role)) {
        score += 24;
        matchedLabels.push(roleLabel(role, locale));
      }

      const matchingColors = requestedColors.filter((color) =>
        candidate.context.colors.some(
          (candidateColor) =>
            normalizeComparable(candidateColor).includes(color.value),
        ),
      );

      if (matchingColors.length > 0) {
        score += 18;
        matchedLabels.push(matchingColors[0].label[locale]);
      }

      return {
        candidate,
        index,
        matchedLabels: unique(matchedLabels),
        role,
        score,
      } satisfies ScoredCandidate;
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = wantsOutfit
    ? selectOutfit(scored, limit, request.budget)
    : selectRequestedRoles(scored, requestedRoles, limit, request.budget);

  return selected.map((entry) => ({
    candidate: entry.candidate,
    reason: buildReason(entry, locale, wantsOutfit),
    ...(buildStylingTip(entry.role, locale, wantsOutfit)
      ? { stylingTip: buildStylingTip(entry.role, locale, wantsOutfit) }
      : {}),
  }));
}

export function buildStyleFallbackSummary(
  request: NormalizedStyleAdviceRequest,
  resultCount: number,
  totalPrice: number,
): string {
  const locale = detectLocale(buildPrompt(request));

  if (resultCount === 0) {
    return locale === 'vi'
      ? 'Không tìm thấy sản phẩm còn hàng phù hợp. Hãy thử nới ngân sách, màu sắc, kích cỡ hoặc phong cách.'
      : 'No matching in-stock products were found. Try broadening your budget, color, size, or style preferences.';
  }

  if (request.budget !== undefined) {
    return locale === 'vi'
      ? `Đã chọn ${resultCount} sản phẩm phù hợp với tổng giá ${formatVnd(totalPrice)}, không vượt ngân sách ${formatVnd(request.budget)}.`
      : `I selected ${resultCount} matching item${resultCount === 1 ? '' : 's'} totaling ${formatVnd(totalPrice)}, within your ${formatVnd(request.budget)} budget.`;
  }

  return locale === 'vi'
    ? `Đã phân tích yêu cầu và chọn ${resultCount} sản phẩm còn hàng phù hợp nhất từ catalog.`
    : `I analyzed your request and selected the ${resultCount} best-matching in-stock catalog items.`;
}

export function buildStyleFallbackTips(
  request: NormalizedStyleAdviceRequest,
): string[] {
  const locale = detectLocale(buildPrompt(request));

  return locale === 'vi'
    ? [
        'Kiểm tra màu sắc, kích cỡ và giá hiện tại trên trang sản phẩm trước khi thêm vào giỏ hàng.',
      ]
    : [
        'Check the current color, size, and price on the product page before adding an item to your cart.',
      ];
}

function selectOutfit(
  candidates: ScoredCandidate[],
  limit: number,
  budget: number | undefined,
): ScoredCandidate[] {
  if (budget !== undefined) {
    return selectBudgetedOutfit(candidates, limit, budget);
  }

  const firstCandidate = candidates[0];

  if (!firstCandidate) {
    return [];
  }

  const selected: ScoredCandidate[] = [firstCandidate];
  const roleOrder: OutfitRole[] =
    firstCandidate.role === 'dress'
      ? ['outerwear', 'accessory', 'top', 'bottom']
      : ['top', 'bottom', 'outerwear', 'accessory', 'dress'];

  for (const role of roleOrder) {
    const match = candidates.find(
      (candidate) => candidate.role === role && !selected.includes(candidate),
    );

    if (match && selected.length < limit) {
      selected.push(match);
    }
  }

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }

    if (!selected.includes(candidate)) {
      selected.push(candidate);
    }
  }

  return selected.sort(
    (left, right) => right.score - left.score || left.index - right.index,
  );
}

function selectBudgetedOutfit(
  candidates: ScoredCandidate[],
  limit: number,
  budget: number,
): ScoredCandidate[] {
  const affordable = candidates.filter(
    (candidate) => candidate.candidate.context.priceMin <= budget,
  );
  const tops = affordable.filter((candidate) => candidate.role === 'top');
  const bottoms = affordable.filter((candidate) => candidate.role === 'bottom');
  const dresses = affordable.filter((candidate) => candidate.role === 'dress');
  let selected: ScoredCandidate[] = [];

  const bestCorePair = tops
    .flatMap((top) =>
      bottoms.map((bottom) => ({
        items: [top, bottom],
        price:
          top.candidate.context.priceMin + bottom.candidate.context.priceMin,
        score: top.score + bottom.score,
      })),
    )
    .filter((pair) => pair.price <= budget)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.price - right.price ||
        left.items[0].index - right.items[0].index,
    )[0];
  const bestDress = dresses[0];

  if (bestCorePair) {
    selected = bestCorePair.items;
  } else if (bestDress) {
    selected = [bestDress];
  } else {
    const bestCoreItem = affordable.find(
      (candidate) =>
        candidate.role === 'top' || candidate.role === 'bottom',
    );

    if (bestCoreItem) {
      // Do not fill an incomplete outfit with accessories. Returning one strong
      // core piece is more useful than suggesting unrelated items up to budget.
      return [bestCoreItem];
    }

    return affordable[0] ? [affordable[0]] : [];
  }

  for (const role of ['outerwear', 'accessory'] satisfies OutfitRole[]) {
    if (selected.length >= limit) {
      break;
    }

    const remainingBudget = budget - totalCandidatePrice(selected);
    const addition = affordable.find(
      (candidate) =>
        candidate.role === role &&
        !selected.includes(candidate) &&
        candidate.candidate.context.priceMin <= remainingBudget,
    );

    if (addition) {
      selected.push(addition);
    }
  }

  return selected.sort(
    (left, right) => right.score - left.score || left.index - right.index,
  );
}

function selectRequestedRoles(
  candidates: ScoredCandidate[],
  requestedRoles: OutfitRole[],
  limit: number,
  budget: number | undefined,
): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];

  for (const role of unique(requestedRoles)) {
    const remainingBudget =
      budget === undefined ? undefined : budget - totalCandidatePrice(selected);
    const match = candidates.find(
      (candidate) =>
        candidate.role === role &&
        !selected.includes(candidate) &&
        (remainingBudget === undefined ||
          candidate.candidate.context.priceMin <= remainingBudget),
    );

    if (match && selected.length < limit) {
      selected.push(match);
    }
  }

  if (selected.length === 0 && budget !== undefined) {
    const affordable = candidates.find(
      (candidate) => candidate.candidate.context.priceMin <= budget,
    );

    return affordable ? [affordable] : [];
  }

  return selected;
}

function totalCandidatePrice(candidates: ScoredCandidate[]): number {
  return candidates.reduce(
    (total, candidate) => total + candidate.candidate.context.priceMin,
    0,
  );
}

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

function buildReason(
  candidate: ScoredCandidate,
  locale: StyleLocale,
  wantsOutfit: boolean,
): string {
  if (candidate.matchedLabels.length > 0) {
    const matches = candidate.matchedLabels.slice(0, 2).join(', ');

    return locale === 'vi'
      ? `Sản phẩm này phù hợp với yêu cầu ${matches} của bạn và hiện vẫn còn hàng.`
      : `This item matches your request for ${matches} and is currently in stock.`;
  }

  if (wantsOutfit && candidate.role) {
    return locale === 'vi'
      ? `Món ${roleLabel(candidate.role, locale)} này giúp hoàn thiện outfit và hiện vẫn còn hàng.`
      : `This in-stock ${roleLabel(candidate.role, locale)} helps complete the outfit.`;
  }

  return locale === 'vi'
    ? 'Đây là một lựa chọn còn hàng gần nhất với các tiêu chí bạn đã nhập.'
    : 'This is one of the closest in-stock matches for the preferences you entered.';
}

function buildStylingTip(
  role: OutfitRole | undefined,
  locale: StyleLocale,
  wantsOutfit: boolean,
): string | undefined {
  if (!wantsOutfit || !role) {
    return undefined;
  }

  const tips: Record<OutfitRole, Record<StyleLocale, string>> = {
    top: {
      en: 'Use this as the main upper layer and keep the other pieces coordinated.',
      vi: 'Dùng món này làm lớp áo chính và phối các món còn lại cùng tông.',
    },
    bottom: {
      en: 'Pair it with the selected top to anchor the outfit.',
      vi: 'Phối món này với áo được chọn để tạo phần nền cho outfit.',
    },
    outerwear: {
      en: 'Add it as the finishing outer layer when the weather suits.',
      vi: 'Khoác ngoài để hoàn thiện tổng thể khi thời tiết phù hợp.',
    },
    dress: {
      en: 'Let this be the main piece, then finish with a light layer or accessory.',
      vi: 'Dùng món này làm điểm chính, sau đó thêm áo khoác nhẹ hoặc phụ kiện.',
    },
    accessory: {
      en: 'Use this as the final accent rather than the main piece.',
      vi: 'Dùng món này làm điểm nhấn cuối thay vì món chính.',
    },
  };

  return tips[role][locale];
}

function buildPrompt(request: NormalizedStyleAdviceRequest): string {
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

function buildCandidateText(candidate: AiCatalogCandidate): string {
  return normalizeComparable(
    [
      candidate.context.name,
      candidate.context.description,
      ...candidate.context.categories.flatMap((category) => [
        category.name,
        category.slug,
      ]),
      ...candidate.context.colors,
      ...candidate.context.sizes,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' '),
  );
}

function detectRole(candidateText: string): OutfitRole | undefined {
  return ROLE_PATTERNS.find(({ pattern }) => pattern.test(candidateText))?.role;
}

function extractRequestedColors(rawPrompt: string): Array<{
  label: Record<StyleLocale, string>;
  value: string;
}> {
  const prompt = normalizeComparable(rawPrompt);
  const colors = [
    { aliases: ['black', 'den'], label: { en: 'black', vi: 'màu đen' }, value: 'black' },
    { aliases: ['white', 'trang'], label: { en: 'white', vi: 'màu trắng' }, value: 'white' },
    { aliases: ['red', 'mau do'], label: { en: 'red', vi: 'màu đỏ' }, value: 'red' },
    { aliases: ['blue', 'xanh duong'], label: { en: 'blue', vi: 'màu xanh dương' }, value: 'blue' },
    { aliases: ['navy', 'xanh navy'], label: { en: 'navy', vi: 'màu xanh navy' }, value: 'navy' },
    { aliases: ['green', 'xanh la'], label: { en: 'green', vi: 'màu xanh lá' }, value: 'green' },
    { aliases: ['brown', 'nau'], label: { en: 'brown', vi: 'màu nâu' }, value: 'brown' },
    { aliases: ['cream', 'kem'], label: { en: 'cream', vi: 'màu kem' }, value: 'cream' },
    { aliases: ['beige'], label: { en: 'beige', vi: 'màu beige' }, value: 'beige' },
    { aliases: ['grey', 'gray', 'xam'], label: { en: 'grey', vi: 'màu xám' }, value: 'grey' },
  ];

  return colors
    .filter((color) =>
      color.aliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(prompt)) ||
      (color.value === 'red' && /\bđỏ\b/i.test(rawPrompt)),
    )
    .map(({ label, value }) => ({ label, value }));
}

function tokenize(value: string): string[] {
  return unique(
    value
      .split(/[^a-z0-9-]+/)
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
  );
}

function detectLocale(value: string): StyleLocale {
  const comparable = normalizeComparable(value);

  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    value,
  ) ||
    /\b(?:cho|minh|toi|tui|di choi|di hoc|di lam|quan|ao|vay|dam|phoi do|mau|ngan sach)\b/.test(
      comparable,
    )
    ? 'vi'
    : 'en';
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9.,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBudgetValue(
  rawValue: string,
  rawUnit: string | undefined,
): number | undefined {
  const unit = rawUnit?.toLocaleLowerCase();
  let normalizedValue = rawValue;

  if (unit === 'trieu' || unit === 'm' || unit === 'million') {
    normalizedValue = rawValue.replace(',', '.');
  } else {
    normalizedValue = rawValue.replace(/[.,]/g, '');
  }

  const value = Number(normalizedValue);
  const multiplier =
    unit === 'k'
      ? 1_000
      : unit === 'nghin' || unit === 'ngan'
        ? 1_000
        : unit === 'tram' || unit === 'tram nghin' || unit === 'tram ngan'
          ? 100_000
      : unit === 'trieu' || unit === 'm' || unit === 'million'
        ? 1_000_000
        : 1;
  const budget = Math.round(value * multiplier);

  return Number.isFinite(budget) && budget >= 0 && budget <= 2_000_000_000
    ? budget
    : undefined;
}

function roleLabel(role: OutfitRole, locale: StyleLocale): string {
  const labels: Record<OutfitRole, Record<StyleLocale, string>> = {
    top: { en: 'top', vi: 'áo' },
    bottom: { en: 'bottom', vi: 'quần hoặc chân váy' },
    outerwear: { en: 'outer layer', vi: 'áo khoác' },
    dress: { en: 'dress', vi: 'đầm' },
    accessory: { en: 'accessory', vi: 'phụ kiện' },
  };

  return labels[role][locale];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
