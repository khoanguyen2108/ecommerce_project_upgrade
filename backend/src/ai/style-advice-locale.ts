import type { NormalizedStyleAdviceRequest } from './dto/style-advice.dto';

export type StyleAdviceLocale = 'en' | 'vi';

interface LanguageSignal {
  pattern: RegExp;
  weight: number;
}

const NATURAL_VIETNAMESE_START = /^(?:cho\s+tui|minh|toi|tui)\b/;

const VIETNAMESE_SIGNALS: LanguageSignal[] = [
  { pattern: /\bcho\s+tui\b/, weight: 4 },
  { pattern: /\bphoi\s+do\b/, weight: 3 },
  { pattern: /\bmac\s+gi\b/, weight: 3 },
  { pattern: /\bngan\s+sach\b/, weight: 3 },
  { pattern: /\bphu\s+kien\b/, weight: 2 },
  { pattern: /\bdi\s+choi\b/, weight: 2 },
  { pattern: /\bdi\s+cafe\b/, weight: 2 },
  { pattern: /\bform\s+rong\b/, weight: 2 },
  { pattern: /\bhang\s+ngay\b/, weight: 2 },
  { pattern: /\b(?:xin\s+chao|don\s+hang|giao\s+hang|doi\s+tra)\b/, weight: 2 },
  { pattern: /\b(?:san\s+pham|quan\s+ao|goi\s+y|giup\s+(?:minh|toi))\b/, weight: 2 },
  { pattern: /\b(?:tui|minh|toi|muon)\b/, weight: 2 },
  { pattern: /\b(?:ao|quan|giay|duoi|doi|giu|khong|mau)\b/, weight: 2 },
];

const ENGLISH_SIGNALS: LanguageSignal[] = [
  { pattern: /\bi\s+(?:want|need|would like|prefer)\b/, weight: 4 },
  { pattern: /\bwhat\s+should\s+i\s+wear\b/, weight: 4 },
  { pattern: /\bgoing\s+out\b/, weight: 2 },
  { pattern: /\bno\s+(?:jacket|coat|accessories|bag)\b/, weight: 2 },
  { pattern: /\b(?:with|without|just|under|budget|wear|please)\b/, weight: 1 },
  {
    pattern:
      /\b(?:shirt|tee|top|pants|jeans|shoes|boots|jacket|bag|accessories)\b/,
    weight: 1,
  },
];

const VIETNAMESE_CHARACTER_PATTERN =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function detectStyleAdviceLocale(
  value: string | NormalizedStyleAdviceRequest,
): StyleAdviceLocale {
  const text = typeof value === 'string' ? value : buildLocaleText(value);
  const comparable = normalizeComparable(text);

  if (NATURAL_VIETNAMESE_START.test(comparable)) {
    return 'vi';
  }

  const vietnameseScore =
    scoreSignals(comparable, VIETNAMESE_SIGNALS) +
    (VIETNAMESE_CHARACTER_PATTERN.test(text) ? 2 : 0);
  const englishScore = scoreSignals(comparable, ENGLISH_SIGNALS);

  return vietnameseScore >= 2 && vietnameseScore > englishScore ? 'vi' : 'en';
}

function buildLocaleText(request: NormalizedStyleAdviceRequest): string {
  return [
    request.notes,
    request.style,
    request.occasion,
    ...request.preferredColors,
    request.bodyType,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function scoreSignals(value: string, signals: LanguageSignal[]): number {
  return signals.reduce(
    (score, signal) => score + (signal.pattern.test(value) ? signal.weight : 0),
    0,
  );
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
